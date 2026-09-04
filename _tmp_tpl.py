import sys
import os
import base64
sys.path.append(os.path.join(os.path.dirname(__file__), "fingerprint-code"))
from zk import ZK

zk = ZK('192.168.100.5', port=4370, timeout=5, force_udp=False)
try:
    conn = zk.connect()
    users = conn.get_users()
    for u in users:
        print(f"Checking user {u.uid} / {u.user_id}")
        tpl = conn.get_user_template(uid=u.uid, temp_id=0, user_id=u.user_id)
        if tpl:
            print(f"Found template! Size: {tpl.size}, Type: {type(tpl.template)}")
            if hasattr(tpl, 'template'):
                b64 = base64.b64encode(tpl.template).decode('ascii')
                print(f"Base64 snippet: {b64[:50]}")
            break
except Exception as e:
    print(e)
finally:
    if 'conn' in locals() and conn:
        conn.disconnect()
