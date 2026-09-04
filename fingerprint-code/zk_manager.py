"""MB100-compatible ZKTeco bridge (TCP-only, pyzk 0.9).

One-shot CLI: each json_* action prints exactly ONE JSON line to stdout.
Human-readable logs go to stderr. Never call get_templates() (Face blobs
crash vanilla pyzk). get_users()/get_attendance()/live_capture() in pyzk 0.9
already auto-detect 28B vs 72B user structs and 8/16/40B log records.
"""
import sys
import io
import json
import os
import socket
import traceback

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

DEVICE_IP = os.environ.get("ZKTECO_IP", "192.168.100.5")
DEVICE_PORT = int(os.environ.get("ZKTECO_PORT", "4370") or 4370)

try:
    _pwd_raw = os.environ.get("ZKTECO_PASSWORD", os.environ.get("ZKTECO_COMMKEY", "0"))
    DEVICE_PASSWORD = int(str(_pwd_raw).strip() or 0)
except (ValueError, TypeError):
    DEVICE_PASSWORD = 0

try:
    DEVICE_TIMEOUT = max(3, min(30, int(os.environ.get("ZKTECO_TIMEOUT", "10") or 10)))
except (ValueError, TypeError):
    DEVICE_TIMEOUT = 10


def _log(msg):
    print(msg, file=sys.stderr, flush=True)


def _emit(obj):
    print(json.dumps(obj, ensure_ascii=False), flush=True)


class ZKController:
    """TCP-only controller for MB100 / Linux TFT devices."""

    def __init__(self, ip=DEVICE_IP, port=DEVICE_PORT):
        from zk import ZK
        self.ip = ip
        self.port = port
        # MB100 ignores UDP ping — force TCP, skip ping (Bug 1 fix).
        self.zk = ZK(
            self.ip, port=self.port, timeout=DEVICE_TIMEOUT,
            password=DEVICE_PASSWORD, force_udp=False, ommit_ping=True,
        )
        self.conn = None

    def connect(self, quiet=False):
        try:
            self.conn = self.zk.connect()
            if not quiet:
                _log(f"[+] Connected to {self.ip}:{self.port} (TCP)")
            return True
        except Exception as e:
            if not quiet:
                _log(f"[-] TCP connection failed: {e}")
                _log("Hint: device and server must be on the same LAN; "
                      "check ZKTECO_IP/PORT, firewall, and that no other "
                      "process holds the device (single-connection only).")
            self.conn = None
            return False

    def get_info(self):
        if not self.conn:
            return {}
        info = {}
        for key, fn in (
            ("deviceName", "get_device_name"),
            ("serialNumber", "get_serialnumber"),
            ("mac", "get_mac"),
            ("firmwareVersion", "get_firmware_version"),
            ("platform", "get_platform"),
        ):
            try:
                info[key] = getattr(self.conn, fn)()
            except Exception as e:
                _log(f"[WARN] {fn} failed: {e}")
        return info

    def unlock_door(self, seconds=3):
        if not self.conn:
            return False
        try:
            return bool(self.conn.unlock(time=int(seconds)))
        except Exception as e:
            _log(f"[-] unlock failed: {e}")
            return False

    def _read_users(self):
        """Call get_users() compatibly (pyzk 0.9 takes no args; some forks
        accept extended=True). Auto-detects 28B vs 72B records."""
        try:
            return self.conn.get_users()
        except TypeError:
            try:
                return self.conn.get_users(extended=True)
            except TypeError:
                return self.conn.get_users(True)
        except struct_error():
            raise

    def list_users(self):
        if not self.conn:
            return []
        self.conn.disable_device()
        try:
            try:
                users = self._read_users()
            except Exception as e:
                _log(f"[-] get_users failed (likely Face-template parse or "
                     f"struct mismatch): {e}")
                return []
            out = []
            for u in users or []:
                try:
                    out.append({
                        "uid": getattr(u, "uid", 0),
                        "userid": str(getattr(u, "user_id", "")),
                        "name": getattr(u, "name", "") or "",
                        "role": getattr(u, "privilege", 0),
                        "card": getattr(u, "card", 0),
                    })
                except Exception as e:
                    _log(f"[WARN] skipping undecodable user record: {e}")
            return out
        finally:
            try:
                self.conn.enable_device()
            except Exception:
                pass

    def get_attendance(self):
        if not self.conn:
            return []
        self.conn.disable_device()
        try:
            try:
                logs = self.conn.get_attendance()
            except Exception as e:
                _log(f"[-] get_attendance failed: {e}")
                return []
            out = []
            for log in logs or []:
                ts = getattr(log, "timestamp", "")
                out.append({
                    "user_id": str(getattr(log, "user_id", "")),
                    "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
                    "status": getattr(log, "status", 0),
                    "punch": getattr(log, "punch", 0),
                })
            return out
        finally:
            try:
                self.conn.enable_device()
            except Exception:
                pass

    def delete_user(self, user_id):
        """Delete a user (and their fingerprint template) from the device by user_id string."""
        if not self.conn:
            return {"success": False, "error": "Not connected"}
        user_id = str(user_id).strip()
        if not user_id:
            return {"success": False, "error": "user_id is required"}
        try:
            users = self._read_users()
        except Exception:
            users = []
        uid = None
        for u in users or []:
            if str(getattr(u, "user_id", "")) == user_id:
                uid = getattr(u, "uid", None)
                break
        if uid is None:
            # Not on device — treat as success (idempotent).
            return {"success": True, "note": "User not found on device (already removed)"}
        self.conn.disable_device()
        try:
            self.conn.delete_user(uid=int(uid))
            try:
                self.conn.refresh_data()
            except Exception:
                pass
            _log(f"[+] Deleted device user uid={uid} user_id={user_id}")
            return {"success": True, "uid": int(uid), "user_id": user_id}
        except Exception as e:
            _log(f"[-] delete_user failed: {e}")
            return {"success": False, "error": str(e)}
        finally:
            try:
                self.conn.enable_device()
            except Exception:
                pass

    def wipe_device(self):
        """Clear ATTENDANCE LOGS ONLY. Never CMD_CLEAR_DATA (wipes users)."""
        if not self.conn:
            return False
        self.conn.disable_device()
        try:
            self.conn.clear_attendance()
            try:
                self.conn.refresh_data()
            except Exception:
                pass
            return True
        except Exception as e:
            _log(f"[-] wipe failed: {e}")
            return False
        finally:
            try:
                self.conn.enable_device()
            except Exception:
                pass

    def live_listen(self):
        if not self.conn:
            return
        _emit({"event": "status", "connected": True})
        heartbeats = 0
        try:
            for att in self.conn.live_capture():
                if att is None:
                    # pyzk yields None every ~10s with no scan — heartbeat.
                    heartbeats += 1
                    if heartbeats % 3 == 0:
                        _emit({"event": "status", "connected": True,
                               "heartbeat": True})
                    continue
                heartbeats = 0
                try:
                    ts = att.timestamp
                    payload = {
                        "event": "attendance",
                        "deviceUserId": str(att.user_id),
                        "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
                        "punch": getattr(att, "punch", 0),
                        "status": getattr(att, "status", 0),
                    }
                    _emit(payload)
                except Exception as e:
                    _log(f"[WARN] bad live record: {e}")
        except (KeyboardInterrupt, SystemExit):
            pass
        except Exception as e:
            _log(f"[-] live_capture ended: {e}")
            _emit({"event": "status", "connected": False, "error": str(e)})
        finally:
            try:
                self.conn.end_live_capture = True
            except Exception:
                pass

    def enroll_fingerprint(self, user_id, name=""):
        """Enroll finger template 0 via the library (handles TCP framing).

        Ensures the user row exists first (set_user), then uses
        conn.enroll_user() instead of raw-socket hacks.

        pyzk quirk: on MB100/ZK Linux TFT (TCP) the first regevent packet
        often carries res==0 which the library treats as timeout/failure,
        returning done=False even when all 3 finger placements succeeded.
        We cross-check by reading the template back from the device; if it
        exists we treat the enrollment as successful regardless.
        """
        if not self.conn:
            return {"success": False, "error": "Not connected"}
        user_id = str(user_id).strip()
        if not user_id:
            return {"success": False, "error": "user_id is required"}
        name = (name or f"Member {user_id}").strip()[:24]
        temp_id = 0
        try:
            try:
                users = self._read_users()
            except Exception:
                users = []
            uid = None
            for u in users or []:
                if str(getattr(u, "user_id", "")) == user_id:
                    uid = getattr(u, "uid", None)
                    break
            if uid is None:
                try:
                    uid = int(self.conn.next_uid or 0) or (
                        max([getattr(u, "uid", 0) for u in users] or [0]) + 1)
                except Exception:
                    uid = 1
                try:
                    self.conn.set_user(uid=uid, name=name, privilege=0,
                                       password="", group_id="",
                                       user_id=user_id, card=0)
                except Exception as e:
                    # User may already exist on device — continue to enroll.
                    _log(f"[WARN] set_user({user_id}) note: {e}")
                    try:
                        users = self._read_users()
                        for u in users or []:
                            if str(getattr(u, "user_id", "")) == user_id:
                                uid = getattr(u, "uid", uid)
                                break
                    except Exception:
                        pass
            try:
                self.conn.cancel_capture()
            except Exception:
                pass

            # Delete any stale template in this slot BEFORE enrolling.
            # Without this, re-enrolling the same uid/temp_id causes the device
            # to report res==5 (finger duplicate) on the final packet because the
            # old template is still present and the new scan matches it.
            try:
                self.conn.delete_user_template(uid=int(uid), temp_id=temp_id)
                _log(f"[INFO] Cleared old template uid={uid} temp={temp_id} "
                     f"before re-enroll.")
            except Exception as del_err:
                _log(f"[INFO] No old template to clear (uid={uid}): {del_err}")

            # Capture pyzk verbose output so we can detect res==5 (finger
            # duplicate = this fingerprint is already registered to a different
            # user on the device) and surface a clear error.
            import io as _io
            import builtins as _bt
            _verbose_buf = _io.StringIO()
            _orig_verbose = getattr(self.conn, 'verbose', False)
            _orig_print = _bt.print
            def _capture_print(*a, **kw):
                _verbose_buf.write(" ".join(str(x) for x in a) + "\n")
            try:
                self.conn.verbose = True
                _bt.print = _capture_print
                done = bool(self.conn.enroll_user(uid=int(uid), temp_id=temp_id,
                                                  user_id=user_id))
            except Exception as e:
                return {"success": False, "error": f"Enrollment failed: {e}"}
            finally:
                _bt.print = _orig_print
                self.conn.verbose = _orig_verbose

            verbose_out = _verbose_buf.getvalue()
            _log(f"[DBG enroll] {verbose_out.strip()}")

            # pyzk TCP path: res==0 on first regevent packet is "ok/ready" on
            # MB100/ZK Linux TFT but the library treats it as failure and returns
            # done=False.  Verify by fetching the template directly — if it exists
            # the 3 scans were accepted.
            if not done:
                # Detect res==5 (finger duplicate — belongs to a different user).
                if "finger duplicate" in verbose_out.lower():
                    return {
                        "success": False,
                        "error": "Duplicate fingerprint — this finger is already "
                                 "enrolled to a different member on the device. "
                                 "Use a different finger or remove the other "
                                 "member's template first."
                    }
                try:
                    tpl = self.conn.get_user_template(uid=int(uid),
                                                      temp_id=temp_id,
                                                      user_id=user_id)
                    if tpl is not None and tpl is not False:
                        _log(f"[INFO] enroll_user returned False but template "
                             f"confirmed present on device — treating as success.")
                        done = True
                except Exception as tpl_err:
                    _log(f"[WARN] template verification check failed: {tpl_err}")

            if done:
                return {"success": True, "user_id": user_id, "uid": int(uid)}
            return {"success": False,
                    "error": "Enrollment timed out — member did not place the "
                             "finger 3 times within the allowed time. "
                             "Please try again."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def disconnect(self):
        if self.conn:
            try:
                self.conn.disconnect()
            except Exception:
                pass
            self.conn = None


def struct_error():
    try:
        import struct
        return struct.error
    except Exception:
        return Exception


def run_diag():
    import importlib.metadata as _md
    try:
        pyzk_ver = _md.version("pyzk")
    except Exception:
        pyzk_ver = "unknown"
    tcp_ok, tcp_err = False, ""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(3)
    try:
        s.connect((DEVICE_IP, DEVICE_PORT))
        tcp_ok = True
    except Exception as e:
        tcp_err = str(e)
    finally:
        s.close()
    return {
        "ip": DEVICE_IP,
        "port": DEVICE_PORT,
        "tcpReachable": tcp_ok,
        "tcpError": tcp_err,
        "timeout": DEVICE_TIMEOUT,
        "authConfigured": DEVICE_PASSWORD != 0,
        "pyzkVersion": pyzk_ver,
    }


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "info"
    is_json = action.startswith("json_") or action == "listen"
    ctrl = ZKController()

    if action in ("diag", "json_diag"):
        info = run_diag()
        if action == "json_diag":
            _emit(info)
        else:
            for k, v in info.items():
                print(f"{k}: {v}")
        return

    if not ctrl.connect(quiet=is_json):
        if is_json:
            diag = run_diag()
            _emit({"error": "Failed to connect to device",
                   "connected": False,
                   "hint": f"Check {diag['ip']}:{diag['port']} reachable from "
                           f"this host (TCP open: {diag['tcpReachable']}). "
                           f"Same LAN? Firewall? Another process holding the "
                           f"device? Details: {diag['tcpError']}",
                   "diag": diag})
        sys.exit(1)

    try:
        if action == "info":
            for k, v in ctrl.get_info().items():
                print(f"{k}: {v}")
        elif action == "json_info":
            _emit(ctrl.get_info())
        elif action == "users":
            users = ctrl.list_users()
            print(f"\n[+] Total Users: {len(users)}")
            for u in users:
                print(f" - ID: {u['userid']} | Name: {u['name']} | "
                      f"Privilege: {u['role']} | Card: {u['card']}")
        elif action == "json_users":
            _emit(ctrl.list_users())
        elif action == "attendance":
            logs = ctrl.get_attendance()
            print(f"\n[+] Total Attendance Logs: {len(logs)}")
            for log in logs[-20:]:
                print(f" - User: {log['user_id']} | Time: {log['timestamp']} | "
                      f"Status: {log['status']} | Punch: {log['punch']}")
        elif action == "json_attendance":
            _emit(ctrl.get_attendance())
        elif action == "unlock":
            sec = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 3
            print(f"[+] Unlock triggered: {ctrl.unlock_door(sec)}")
        elif action == "json_unlock":
            sec = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 3
            _emit({"success": ctrl.unlock_door(sec)})
        elif action == "wipe":
            print(f"[+] Attendance-log wipe successful: {ctrl.wipe_device()}")
        elif action == "json_wipe":
            _emit({"success": ctrl.wipe_device()})
        elif action == "enroll":
            user_id = sys.argv[2] if len(sys.argv) > 2 else "1"
            name = " ".join(sys.argv[3:]) if len(sys.argv) > 3 else ""
            print(f"[+] Enroll result: {ctrl.enroll_fingerprint(user_id, name)}")
        elif action == "json_enroll":
            user_id = sys.argv[2] if len(sys.argv) > 2 else "1"
            name = " ".join(sys.argv[3:]) if len(sys.argv) > 3 else ""
            _emit(ctrl.enroll_fingerprint(user_id, name))
        elif action == "delete":
            user_id = sys.argv[2] if len(sys.argv) > 2 else ""
            print(f"[+] Delete result: {ctrl.delete_user(user_id)}")
        elif action == "json_delete_user":
            user_id = sys.argv[2] if len(sys.argv) > 2 else ""
            _emit(ctrl.delete_user(user_id))
        elif action == "listen":
            ctrl.live_listen()
        else:
            print(f"Unknown action: {action}", file=sys.stderr)
            sys.exit(2)
    except Exception:
        traceback.print_exc(file=sys.stderr)
        if is_json:
            _emit({"error": "Device action failed", "connected": False})
        sys.exit(1)
    finally:
        ctrl.disconnect()


if __name__ == "__main__":
    main()
