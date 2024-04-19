# API
API component of [projetoumportodostodosporum.org's](https://projetoumportodostodosporum.org) website.


## Dependencies
- [Server Component](https://github.com/ProjetoUmPorTodosTodosPorUm/server)
- [asdf](https://asdf-vm.com/guide/getting-started.html)


## Install
```bash
$ asdf install
$ npm install
```


## Environment Vars
Create a copy from ".env.dev.example" file in the root folder and rename to ".env.dev" and update it accordingly.


## Run
### Development
```bash
$ npm run dev
```

### Preview
Build the preview image of this componenet with ``$ npm run build:docker:preview`` and others, then start the [Server](https://github.com/ProjetoUmPorTodosTodosPorUm/server) in preview mode.

### Production
Build the production image of this componenet with ``$ npm run build:docker`` and others, then start the [Server](https://github.com/ProjetoUmPorTodosTodosPorUm/server) in production mode.


## Documentation 
Running in development mode access http://api.localhost/doc.


## Prisma Studio
Running in development mode: ``$ npm run prisma:studio``


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


## Related Repositories
- [Server](https://github.com/ProjetoUmPorTodosTodosPorUm/server) (server)
- [Website](https://github.com/ProjetoUmPorTodosTodosPorUm/web) (web)
- [Content Management](https://github.com/ProjetoUmPorTodosTodosPorUm/cms) (cms)
