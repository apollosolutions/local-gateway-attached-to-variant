import { gql } from 'apollo-server';

export const typeDefs = gql`
extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.0",
        import: ["@key", "@shareable"])

  extend type Author @key(fields: "name") {
    name: String!
    " The literary awards won by this author. "
    awards: [Award]
  }

  " An award for excellence in literature. "
  type Award @key(fields: "awardName year") {
    " The title of the book that won the award."
    bookTitle: String
    title: String @deprecated(reason: "Use awardTitle for all new clients.")
    " The year that the award was given. "
    year: Int
    " The author who won the award."
    authorName: String
    " The title of the award, i.e. 'Best Novel'."
    awardTitle: String
    " The name of the award, i.e. 'Hugo Award'."
    awardName: String
  }

  type Query {
    " Get a list of literary awards."
    awards: [Award]
  }
`;
