import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "fingerprint-code"))
from zk import ZK

zk = ZK('192.168.100.5', port=4370, timeout=5, force_udp=False)
try:
    conn = zk.connect()
    # Attempt to get users, though ZK class doesn't always expose raw capacity easily.
    # We can fetch device info
    users = conn.get_users()
    print(f"Current enrolled users: {len(users)}")
    
    # We can also search for capacity in conn properties if available, but usually MB1000/ID handles 2000-3000 fingerprints/users.
except Exception as e:
    print(e)
finally:
    if 'conn' in locals() and conn:
        conn.disconnect()
