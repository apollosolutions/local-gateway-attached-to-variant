import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = yaml.load(
  fs.readFileSync(path.resolve(__dirname, '../settings.yaml'), {
    encoding: 'utf-8',
  })
);

function makeSubgraphQueryPayload() {
  return {
    operationName: 'SubgraphListQuery',
    query: `query SubgraphListQuery($graph_id: ID!, $variant: String!) {
      frontendUrlRoot
      graph(id: $graph_id) {
        variant(name: $variant) {
          subgraphs {
            name
            url
          }
        }
      }
    }`,
    variables: { graph_id: config.graphName, variant: config.variant },
  };
}

export function checkForReplacementSubGraph(apiNames) {
  const configNames = config.replacedServices.map((s) => s.name);

  let found = false;

  for (const replacementName in configNames) {
    if (apiNames.indexOf(replacementName) > -1) {
      found = true;
      break;
    }
  }

  return found;
}

export function getHeaders() {
  return {
    'X-API-KEY': config.apiKey,
    'apolloggraphql-client-name': `LGATV`,
  };
}

export async function GetServiceList() {
  const { data } = await axios.post(
    'https://graphql.api.apollographql.com/api/graphql',
    makeSubgraphQueryPayload(),
    {
      headers: getHeaders(),
    }
  );

  if (data.errors || !data?.data?.graph?.variant?.subgraphs?.length) {
    throw new Error(
      `something went wrong when talking to studio: ${
        data.errors
          ? JSON.stringify(data.errors)
          : 'No graphs were received. Please check your settings have an API key, graph name and variant and try again.'
      }`
    );
  }

  const { subgraphs } = data.data.graph.variant;

  if (checkForReplacementSubGraph(subgraphs.map((s) => s.name))) {
    throw new Error(
      'No subgraph replacements were found. Please make sure the settings.yaml has a service to be replaced.'
    );
  }

  return subgraphs.map((graph) => {
    const i = config.replacedServices.map((s) => s.name).indexOf(graph.name);
    if (i > -1) {
      return config.replacedServices[i];
    } else {
      return graph;
    }
  });
}
