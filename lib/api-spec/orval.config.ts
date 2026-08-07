import { defineConfig, InputTransformerFn } from "orval";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");

// Our exports make assumptions about the title of the API being "Api" (i.e. generated output is `api.ts`).
const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Api";

  return config;
};

export default defineConfig({
  "api-client-react": {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api",
      clean: true,
      prettier: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          /**
           * Pinned to 3, not left on `auto`.
           *
           * orval 8.23 defaults to emitting zod v4 syntax — top-level `z.email()`
           * and `z.int()` — while this workspace pins zod ^3.25.76 and the
           * generated file imports the v3 entry point. The result did not
           * compile, so `pnpm --filter @workspace/api-spec run codegen`, the
           * command replit.md tells people to run, was broken: nobody could
           * regenerate the client after editing the spec.
           *
           * zod 3.25 does ship the v4 API under `zod/v4`, so moving up is a
           * real option — but it is a change to every generated schema and to
           * what the rest of the workspace validates against, which is not a
           * side effect a codegen fix should have. Stating the version we are
           * on makes the command work today and makes the upgrade a decision
           * someone takes deliberately.
           */
          version: 3,
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
            body: ['bigint', 'date'],
            response: ['bigint', 'date'],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});
