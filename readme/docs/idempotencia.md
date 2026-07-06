> ## Documentation Index
> Fetch the complete documentation index at: https://developers.celcoin.com.br/llms.txt
> Use this file to discover all available pages before exploring further.

# Idempotencia

## Nesse artigo você irá aprender como:

* O que é idempotencia?
* Como funciona a idempotencia na Celcoin?

## Pré-requisitos para implementação

* Possuir uma chave api da Celcoin, para mais informações acessar esse [link](https://developers.celcoin.com.br/docs/obtendo-acesso-%C3%A0s-apis)
* Ter familiaridade com o padrão [REST ](https://www.devmedia.com.br/rest-tutorial/28912)usando o protocolo [OAuth 2.0](https://oauth.net/2/).
* Ter o produto/solução contratado e habilitado em produção.
  * Caso queira usar a funcionalidade em ambiente produtivo, por favor entre em contato com a nossa equipe comercial através do e-mail <corp@celcoin.com.br.> Para dúvidas técnicas, basta entrar em contato com o suporte através do [link](https://suporte.celcoin.com.br/hc/pt-br/requests/new).

## O que é Idempotência?

Você provavelmente já precisou fazer com que dois serviços se comuniquem entre si e sabe os inúmeros problemas que podem acontecer. A falha nessa comunicação é uma delas, afinal, o que acontece quando você envia uma requisição e não obtém o retorno? O que acontece se, por exemplo, essa requisição sem retorno, for a tentativa do pagamento de um débito veicular?

Uma forma muito simples para tratar este tipo de problema, é utilizar as chaves de idempotência. Essas chaves tem valor único e servem para identificar retentativas de uma mesma requisição.

Com o uso de uma chave de idempotencia, você pode efetuar a mesma requisição inúmeras vezes e obter o mesmo resultado, desta forma você impede que ocorra a duplicação de um pagamento.

## Como funciona a idempotência na Celcoin?

Na API da Celcoin, essa funcionalidade está disponível no fluxo de pagamento na chamada de [Realizar pagamento](https://developers.celcoin.com.br/reference/cria-um-pedido-de-pagamento-ass%C3%ADncrono-para-uma-lista-de-d%C3%A9bitos).

Uma vez que realizado uma requisições, será retornado os seguintes campos:

### Modelo de retorno ao realizar um pagamento:

```json
{
    "paymentId": "EF3CDF61-5748-4C2F-BAFA-7988DA92396D",
    "errorCode": "000",
    "message": "Solicitação recebida com sucesso. Aguarde a resposta do processamento no webhook cadastrado."
}

```

> 📘 O diferencial da chave de idempotência da Celcoin, é que quando realizado a requisição novamente, nós enviamos o webhook de pagamento, desta forma, sua aplicação pode receber e realizar as devidas tratativas.

### Modelo de retorno de webhook de pagamento:

```json
{
    "type": "receipt",
    "paymentId": "29C32257-2DDB-41B0-9BB0-4CB64783443F",
    "receipt": {
        "licensePlate": "DIS9865",
        "renavam": "01203988813",
        "state": "DF",
        "description": "Licenciamento 2022",
        "debtId": "312D6A5F-2B5A-4694-84DA-F640FC01CC74",
        "amount": 1009.36,
        "authentication": "F2.2D.2C.32.74.24.11.59.81.C1.FD.C2.91.A3.BF.93",
        "dueDate": "2022-12-28T00:00:00",
        "clientRequestId": "29d648b8-594f-436c-ba53-a543fdaf9467",
        "year": 2022,
        "payDate": "2022-12-28T00:00:00"
    }
}


```

> 📘 É importante ressaltar que esse comportamento é aplicado para o webhook, de pagamento do produto débito veicular. Para mais informações sobre quais webhooks  são retornados pela nossa aplicação, acesse a nossa [documentação](https://developers.celcoin.com.br/docs/sobre-a-api-de-auto).

> 📘 Os exemplos acima são de veículos que retornam débitos e que o pagamento foi feito com o sucesso. Como falado, iremos reenviar o webhook da requisição enviada anteriormente.

> 📘 Para o fluxo de consulta, caso você realize um consulta com os mesmos dados já informados, será exibido na API uma mensagem de erro. Veja abaixo:

```json
{
    "transactionId": 0,
    "message": "Consulta de débitos já realizada com clientRequestId: 14-04-2023-teste-consulta",
    "errorCode": "822"
}

```