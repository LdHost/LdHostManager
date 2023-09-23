# LdHostManager
Web tool to manage a LdHost instance

## Configuration
LdHostManager is expected to be run with another web server which is responsible for the content.
The LdHostManager server can be made available only through a reverse proxy (called "reverse" because "proxy" alone implies a [Web client accelerator](https://en.wikipedia.org/wiki/Web_accelerator#Web_client_accelerator)) side, e.g. through /MANAGE/ in the following Apache2 config:

``` bash
$ runLdHostManager.js 3000 MyLdHostConfig.json
```

``` apacheconf
<VirtualHost *:443>
  ServerName [My Server]
  DocumentRoot /var/www/
  ... [My SSL stuff] ...
  ProxyPass        /MANAGE/ http://127.0.0.1:3000/
  ProxyPassReverse /MANAGE/ http://127.0.0.1:3000/
  ...
</VirtualHost>
```

## Acess control
Currently, LdHostManager has no [authentication/access control](https://en.wikipedia.org/wiki/AAA_(computer_security)) as this is expected to be managed by the content server.
If you want to allow access directly to LdHostManager, you can open a port à la:

``` bash
ufw allow 3000
```

There is currently no access control implemented (see LdHost/LdHostManager#2); PRs welcome.
