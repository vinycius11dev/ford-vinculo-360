# Catálogo autoral do Vínculo 360

O catálogo é mantido no painel administrativo e consumido pelo aplicativo mobile.

## Fluxo

1. Um administrador ou gerente abre `Configurações > Catálogo do aplicativo`.
2. Cadastra identificação (código, ano e versão), resumo, descrição e a ficha técnica completa: motor, combustível, câmbio, tração, potência, torque, consumo, autonomia, dimensões, lugares, garantia e disponibilidade. Também pode informar destaques, imagem autoral, preço opcional, ordem e publicação.
3. Envia uma foto JPG, PNG ou WebP de até 5 MB pelo próprio painel. A API salva a imagem no piloto, registra a auditoria e devolve a URL que o web e o mobile usam.
4. O painel grava o item em `CatalogItem` e registra a alteração na auditoria.
5. O mobile consulta `GET /api/v1/catalog` e exibe somente os itens publicados.

## API

- `GET /api/v1/catalog`: catálogo publicado para clientes e equipe.
- `GET /api/v1/catalog/admin`: todos os itens para a operação.
- `POST /api/v1/catalog`: cria um item.
- `PATCH /api/v1/catalog/:id`: edita ou publica/oculta um item.
- `DELETE /api/v1/catalog/:id`: remove um item.
- `POST /api/v1/catalog/upload`: recebe `file` em multipart/form-data e devolve a URL da imagem autoral.

O conteúdo é próprio do projeto e não depende de catálogo externo. Se um item não tiver imagem, o aplicativo usa a ilustração vetorial autoral como fallback.

Os quatro itens semeados (Atlas, Pulse, Horizon e Trail) usam especificações ilustrativas para a apresentação do piloto. Preço, estoque e imagem são opcionais e devem ser preenchidos pelo administrador quando houver uma fonte oficial do projeto.
