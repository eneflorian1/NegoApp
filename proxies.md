root@elvanelux:~# ./setup_ipv6_proxies.sh
============================================
  PASUL 1: Curăț adresele vechi invalide
============================================
✓ Adrese invalide șterse

============================================
  PASUL 2: Adaug cele 16 adrese IPv6
============================================
✓ Total adrese IPv6 pe eth0: 16
2a03:b0c0:2:f0:0:1:77bb:9000
2a03:b0c0:2:f0:0:1:77bb:9001
2a03:b0c0:2:f0:0:1:77bb:9002
2a03:b0c0:2:f0:0:1:77bb:9003
2a03:b0c0:2:f0:0:1:77bb:9004
2a03:b0c0:2:f0:0:1:77bb:9005
2a03:b0c0:2:f0:0:1:77bb:9006
2a03:b0c0:2:f0:0:1:77bb:9007
2a03:b0c0:2:f0:0:1:77bb:9008
2a03:b0c0:2:f0:0:1:77bb:9009
2a03:b0c0:2:f0:0:1:77bb:900a
2a03:b0c0:2:f0:0:1:77bb:900b
2a03:b0c0:2:f0:0:1:77bb:900c
2a03:b0c0:2:f0:0:1:77bb:900d
2a03:b0c0:2:f0:0:1:77bb:900e
2a03:b0c0:2:f0:0:1:77bb:900f

============================================
  PASUL 3: Configurez 3proxy
============================================
✓ 3proxy configurat cu 16 proxy-uri (porturi 10001-10016)

============================================
  PASUL 4: Pornesc 3proxy
============================================
[line 2] Warning: current open file ulimits are too low (cur: 1024/max: 1048576), maxconn requires at least 6000 for every running service. Configure ulimits according to system documentation
✓ 3proxy rulează (PID: 5620)

============================================
  PASUL 5: Generez listele
============================================
✓ /root/proxy_list.txt generat
http://206.189.10.234:10001
http://206.189.10.234:10002
http://206.189.10.234:10003
http://206.189.10.234:10004
http://206.189.10.234:10005
http://206.189.10.234:10006
http://206.189.10.234:10007
http://206.189.10.234:10008
http://206.189.10.234:10009
http://206.189.10.234:10010
http://206.189.10.234:10011
http://206.189.10.234:10012
http://206.189.10.234:10013
http://206.189.10.234:10014
http://206.189.10.234:10015
http://206.189.10.234:10016

============================================
  PASUL 6: Test TOATE cele 16 proxy-uri
============================================
  ✓ Port 10001 → 2a03:b0c0:2:f0:0:1:77bb:9000
  ✓ Port 10002 → 2a03:b0c0:2:f0:0:1:77bb:9001
  ✓ Port 10003 → 2a03:b0c0:2:f0:0:1:77bb:9002
  ✓ Port 10004 → 2a03:b0c0:2:f0:0:1:77bb:9003
  ✓ Port 10005 → 2a03:b0c0:2:f0:0:1:77bb:9004
  ✓ Port 10006 → 2a03:b0c0:2:f0:0:1:77bb:9005
  ✓ Port 10007 → 2a03:b0c0:2:f0:0:1:77bb:9006
  ✓ Port 10008 → 2a03:b0c0:2:f0:0:1:77bb:9007
  ✓ Port 10009 → 2a03:b0c0:2:f0:0:1:77bb:9008
  ✓ Port 10010 → 2a03:b0c0:2:f0:0:1:77bb:9009
  ✓ Port 10011 → 2a03:b0c0:2:f0:0:1:77bb:900a
  ✓ Port 10012 → 2a03:b0c0:2:f0:0:1:77bb:900b
  ✓ Port 10013 → 2a03:b0c0:2:f0:0:1:77bb:900c
  ✓ Port 10014 → 2a03:b0c0:2:f0:0:1:77bb:900d
  ✓ Port 10015 → 2a03:b0c0:2:f0:0:1:77bb:900e
  ✓ Port 10016 → 2a03:b0c0:2:f0:0:1:77bb:900f

============================================
  REZULTAT: 16/16 funcționează, 0 fail
============================================

  Lista: /root/proxy_list.txt
  Exemplu: curl -x http://206.189.10.234:10001 ifconfig.me
✓ Persistență configurată
root@elvanelux:~#
