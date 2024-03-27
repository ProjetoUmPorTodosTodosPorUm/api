# ProjetoUmPorTodosTodosPorUm.org's API

## Dependencies
- [Docker with Docker Compose](https://docs.docker.com/get-docker/)
- [asdf](https://asdf-vm.com/guide/getting-started.html)

## Install
```bash
$ asdf install
$ npm install
```

## Environment Vars
ENVs from .env.dev's file under 'NESTJS API' and 'DUPLICATI' sections should be loaded, [see how](https://help.ubuntu.com/community/EnvironmentVariables#System-wide_environment_variables).


## Run
### Development
```bash
$ npm run start:dev
```
### Production
```bash
$ npm run build:docker
$ npm run start:prod
```

## Documentation 
Access http://api.localhost/doc. 

## Test
```bash
# Unit Tests
$ npm run test:unit

# Integration Tests
$ npm run test:int

# E2E Tests
$ npm run test:e2e

# Test Coverage
$ npm run test:unit:cov
$ npm run test:int:cov
$ npm run test:e2e:cov
```
## Related
- [Trello Board](https://trello.com/b/oXESZ0u2/web-api)
- [DbDiagram](https://dbdiagram.io/d/63caa51e296d97641d7b071a)

Other repositories related to this:
- [cms-projeto](https://github.com/RenanGalvao/cms-projeto)
- [web-projeto](https://github.com/RenanGalvao/web-projeto)
