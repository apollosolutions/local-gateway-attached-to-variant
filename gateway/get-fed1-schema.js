import { composeAndValidate } from '@apollo/federation-1';
import { buildComposedSchema } from '@apollo/query-planner-1';
import { parse } from 'graphql';

export async function composeWithResolvedConfig(subgraphs) {
  const serviceList = subgraphs.map(({ name, url, sdl }) => ({
    name,
    url: url ?? undefined,
    typeDefs: parse(sdl),
  }));

  const result = composeAndValidate(serviceList);

  //   if (result.supergraphSdl) {
  //     return {
  //       schema: buildComposedSchema(parse(result.supergraphSdl)),
  //       supergraphSdl: result.supergraphSdl,
  //     };
  //   }
  return result.supergraphSdl;
}
