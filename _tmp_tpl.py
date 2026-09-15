import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "fingerprint-code"))
from zk import ZK

zk = ZK('192.168.100.5', port=4370, timeout=5, force_udp=False)
try:
    conn = zk.connect()
    u = conn.get_users()[0]
    tpl = conn.get_user_template(uid=u.uid, temp_id=0, user_id=u.user_id)
    print(type(tpl))
    print(dir(tpl))
except Exception as e:
    print(e)
finally:
    if 'conn' in locals() and conn:
        conn.disconnect()
