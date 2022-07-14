import axios from 'axios';
import {
  RemoteGraphQLDataSource,
  SERVICE_DEFINITION_QUERY,
} from '@apollo/gateway';
import {
  config,
  getHeaders,
  checkForReplacementSubGraph,
} from './get-service-list.js';
import { compose } from '@apollo/composition';
import {
  buildSubgraph,
  errorCauses,
  Subgraphs,
} from '@apollo/federation-internals';

function makeSubgraphSDLQueryPayload() {
  return {
    operationName: 'GetSubgraphSdls',
    query: `query GetSubgraphSdls($serviceId: ID!, $graphVariant: String!) {
        service(id: $serviceId) {
          implementingServices(graphVariant: $graphVariant) {
            ... on FederatedImplementingServices {
              services {
                name
                url
                activePartialSchema {
                  sdl
                }
              }
            }
          }
        }
      }`,
    variables: { serviceId: config.graphName, graphVariant: config.variant },
  };
}

async function composeWithResolvedConfig(graphs) {
  const subgraphs = new Subgraphs();

  graphs.forEach((graph) => {
    console.log(graph);
    try {
      console.log(`
        
        ${typeof graph.sld}
  
        
        `);
      const subgraph = buildSubgraph(
        graph.name,
        graph.url ?? 'http://localhost:4001',
        graph.sld
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

async function loadServicesFromRemoteEndpoint({
  serviceList,
  // getServiceIntrospectionHeaders,
}) {
  if (!serviceList || !serviceList.length) {
    throw new Error(
      'Tried to load services from remote endpoints but none provided'
    );
  }

  // for each service, fetch its introspection schema
  const promiseOfServiceList = serviceList.map(async ({ name, url }) => {
    if (!url) {
      throw new Error(
        `Tried to load schema for '${name}' but no 'url' was specified.`
      );
    }

    const request = {
      query: SERVICE_DEFINITION_QUERY,
      http: {
        url,
        method: 'POST',
      },
    };

    return new RemoteGraphQLDataSource({ url, name })
      .process({
        kind: 'loading schema',
        request,
        context: {},
      })
      .then(({ data, errors }) => {
        if (data && !errors) {
          return {
            name,
            url,
            sld: data._service.sdl,
          };
        }

        console.log(errors);

        throw new Error(errors?.map((e) => e.message).join('\n'));
      })
      .catch((err) => {
        const errorMessage =
          `Couldn't load service definitions for "${name}" at ${url}` +
          (err && err.message ? ': ' + err.message || err : '');

        throw new Error(errorMessage);
      });
  });

  const serviceDefinitions = await Promise.all(promiseOfServiceList);
  return { serviceDefinitions };
}

export async function GetSDLFromStudio() {
  const { data, errors } = await axios.post(
    'https://graphql.api.apollographql.com/api/graphql',
    makeSubgraphSDLQueryPayload(),
    {
      headers: getHeaders(),
    }
  );

  if (errors || !data.data) {
    throw new Error(
      `something went wrong when talking to studio: ${
        errors
          ? JSON.stringify(errors)
          : 'No graphs were received. Please check your settings have an API key, graph name and variant and try again.'
      }`
    );
  }

  const { services } = data.data.service.implementingServices;

  if (checkForReplacementSubGraph(services.map((s) => s.name))) {
    throw new Error(
      'No subgraph replacements were found. Please make sure the settings.yaml has a service to be replaced.'
    );
  }

  const subgraphs = {
    useFromStudio: [],
    local: [],
  };

  services.map((service) => {
    const indexOfReplacement = config.replacedServices
      .map((s) => s.name)
      .indexOf(service.name);

    if (indexOfReplacement > -1) {
      subgraphs.local.push(config.replacedServices[indexOfReplacement]);
    } else {
      subgraphs.useFromStudio.push({
        name: service.name,
        url: service.url,
        sld: service.activePartialSchema.sdl,
      });
    }
  });

  const localLists = await loadServicesFromRemoteEndpoint({
    serviceList: subgraphs.local,
  });

  const allGraphs = [
    ...subgraphs.useFromStudio,
    ...localLists.serviceDefinitions,
  ];

  const composedFed2Schema = await composeWithResolvedConfig(allGraphs);
  return composedFed2Schema.supergraphSdl;
}
