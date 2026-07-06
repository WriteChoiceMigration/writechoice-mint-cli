> ## Documentation Index
> Fetch the complete documentation index at: https://developers.celcoin.com.br/llms.txt
> Use this file to discover all available pages before exploring further.

# Inativar Cartão

Cartões inativos podem ser inativados a qualquer momento.

Para isso, deve-se ter um token válido e utilizar o endpoint **[Inativar Cartão](https://developers.celcoin.com.br/update/reference/inativar-cart%C3%A3o)**.

Um cartão inativo não pode ser reativado. O procedimento correto para isso é a inclusão de um novo cartão.

**Atenção:** ao inativar um cartão, as cobranças futuras com esse cartão não terão sucesso.

# Exemplo de Request

```json
curl --request DELETE \
     --url https://sandbox.openfinance.celcoin.dev/baas/v1/cash/cards/{cardId}/{typeId} \
     --header 'accept: application/json' \
     --header 'authorization: Bearer {TOKEN}
```

<br />

> 👍 Sucesso 200

# Exemplo de Response

```json
{
  "type": true
}
```

<br />