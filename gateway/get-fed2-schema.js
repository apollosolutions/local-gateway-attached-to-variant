import { compose } from '@apollo/composition';
import {
  buildSubgraph,
  errorCauses,
  Subgraphs,
} from '@apollo/federation-internals';

async function composeWithResolvedConfig(graphs) {
  const subgraphs = new Subgraphs();

  graphs.forEach((graph) => {
    try {
      const subgraph = buildSubgraph(
        graph.name,
        graph.url ?? 'http://localhost:4001',
        graph.sdl
      );
      subgraphs.add(subgraph);
    } catch (e) {
      const graphQLCauses = errorCauses(/** @type {Error} */ (e));
      if (graphQLCauses) {
        return {
          errors: graphQLCauses,
        };
      }
      console.log(e);
      throw new Error(`failed to build schema for ${graph.name} subgraph`);
    }
  });

  try {
    return compose(subgraphs);
  } catch (e) {
    if (e instanceof Error) {
      return {
        errors: [new GraphQLError(e.message)],
      };
    }
    if (e instanceof GraphQLError) {
      return {
        errors: [e],
      };
    }
    throw e;
  }
}

export async function GetFedTwoSuperGraphSchema(allGraphs) {
  const composedFed2Schema = await composeWithResolvedConfig(allGraphs);

  if (!composedFed2Schema.schema || composedFed2Schema.errors) {
    console.log('💣 Schema did not compose with Federation v2\n');
    console.log(fed2.errors.map((e) => e.toString()).join('\n\n'));
    console.log('\n');
    throw new Error('Schema did not compile correctly.');
  }

  return composedFed2Schema.supergraphSdl;
}
