## generate clienst from openapi

``` bash
for t = javascript typescript # ...
./node_modules/.bin/openapi-generator-cli generate
  -i spec/openapi/LdHostManager.yaml -g $t -o ./generated/$t
```
