export class MESSAGE {
  static ROUTES = {
    LOGIN: 'Logado com sucesso!',
    LOGOUT: 'Deslogado com sucesso!',
    VALIDATE_TOKEN: 'Token de acesso validado com sucesso!',
    REFRESH_TOKEN: 'Token de acesso atualizado com sucesso!',
    SEND_RECOVER_EMAIL: 'Email para recuperar conta enviado com sucesso!',
    CONFIRM_RECOVER_EMAIL: 'Nova senha criada com sucesso!',
    SEND_CREATE_EMAIL: 'Email para criar conta enviado com sucesso!',
    CONFIRM_CREATE_EMAIL: 'Email de acesso criado com sucesso!',
    RESTRICT: 'Restrições adicionadas ao usuário com sucesso!',
    UNRESTRICT: 'Restrições removidas do usuário com sucesso!',
    GET_REPORTED_YEARS: 'Anos dos relatórios recuperados com sucesso!',
    GET_COLLECTED_PERIOD: 'Anos e meses das ofertas coletadas recuperados com sucesso!',
    HEALTH_CHECK: 'Saúde da API verificada com sucesso!'
  };

  static RESPONSE = {
    NOT_AUTHORIZED: 'Não autorizado.',
  };

  static EXCEPTION = {
    TOKEN: {
      NOT_SET: 'Nenhum token foi solicitado para esse e-mail.',
      PAYLOAD_NOT_SET: 'Este token não possui payload.',
      DONT_MATCH: 'Token inválido.',
      USED: 'Token já foi usado.',
      EXPIRED: 'Token expirado.'
    },
    NOT_AUTHENTICATED: 'Você não está autenticado.',
    NOT_AUTHORIZED: 'Você não está autorizado.',
    FORBIDDEN: 'Você não possui acesso a este recurso.',
    TOO_MANY_REQUESTS: 'Você já fez muitas requisições! Aguarde um pouco.',
    RESTRICTED: 'Você está com acesso restrito! Fale com o administrador do seu campo para mais informações.',
    SEARCH_QUERY_PARITY: 'A query de pesquisa especifica deve possuir o mesmo número de valores como de campos.'
  };

  static MAIL = {
    RECOVER_MAIL_SUBJECT: 'Esqueceu sua senha?',
    CREATE_MAIL_SUBJECT: 'Crie a sua conta no Projeto'
  };
}
