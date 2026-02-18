# API Contracts: Execute Sell Order

- **openapi-sell.yaml**: OpenAPI fragment for `POST /users/{userId}/sales` and related schemas (SellRequest, SellResponse, SellErrorResponse).
- Merge the `paths` and any new `components.schemas` into `src/infrastructure/http/openapi.yaml` during implementation.
- Add tag `Sales` to the main OpenAPI `tags` section if not present.
