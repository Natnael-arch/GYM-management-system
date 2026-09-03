import socket
import sys

def test_connection(ip, port=4370):
    print(f"Testing TCP connection to {ip}:{port}...")
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(3)
    try:
        s.connect((ip, port))
        print(f"[+] Successfully opened TCP port {port} on {ip}")
        s.close()
        return True
    except Exception as e:
        print(f"[-] TCP connection failed: {e}")
    
    print(f"Testing UDP to {ip}:{port}...")
    s_udp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s_udp.settimeout(3)
    try:
        buf = bytearray([0xE8, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
        chk = 0
        for i in range(0, len(buf), 2):
            if i == 2:
                continue
            chk += buf[i] + (buf[i+1] << 8)
        chk = (chk & 0xFFFF)
        chk = 0xFFFF - chk
        buf[2] = chk & 0xFF
        buf[3] = (chk >> 8) & 0xFF
        
        s_udp.sendto(buf, (ip, port))
        data, addr = s_udp.recvfrom(1024)
        print(f"[+] UDP response received from {addr}: {data.hex()}")
        s_udp.close()
        return True
    except Exception as e:
        print(f"[-] UDP ping failed: {e}")
    return False

def scan_network():
    print("Scanning local network for devices on port 4370...")
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        local_ip = s.getsockname()[0]
    finally:
        s.close()
    
    print(f"Local IP: {local_ip}")
    subnet_prefix = '.'.join(local_ip.split('.')[:3])
    
    for i in range(1, 255):
        target = f"{subnet_prefix}.{i}"
        s_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s_sock.settimeout(0.1)
        res = s_sock.connect_ex((target, 4370))
        if res == 0:
            print(f"[FOUND] Device at {target}:4370 (TCP)")
        s_sock.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_connection(sys.argv[1])
    else:
        print("Usage: python zk_connect.py <DEVICE_IP>")
        print("Running automatic subnet scan...")
        scan_network()
