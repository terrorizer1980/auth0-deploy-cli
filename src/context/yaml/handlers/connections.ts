import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';

import log from '../../../logger';
import {
  isFile,
  sanitize,
  ensureProp,
  convertClientIdToName,
  mapClientID2NameSorted,
} from '../../../utils';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedConnections = ParsedAsset<'connections', Asset[]>;

async function parse(context: YAMLContext): Promise<ParsedConnections> {
  const { connections } = context.assets;
  const connectionsFolder = path.join(context.basePath, constants.CONNECTIONS_DIRECTORY);

  if (!connections) {
    return { connections: null };
  }

  return {
    connections: [
      ...connections.map((connection) => {
        if (connection.strategy === 'email') {
          ensureProp(connection, 'options.email.body');
          const htmlFileName = path.join(connectionsFolder, connection.options.email.body);

          if (isFile(htmlFileName)) {
            connection.options.email.body = context.loadFile(htmlFileName);
          }
        }

        return connection;
      }),
    ],
  };
}

const getFormattedOptions = (connection, clients) => {
  try {
    return {
      options: {
        ...connection.options,
        idpinitiated: {
          ...connection.options.idpinitiated,
          client_id: convertClientIdToName(connection.options.idpinitiated.client_id, clients),
        },
      },
    };
  } catch (e) {
    return {};
  }
};

async function dump(context: YAMLContext): Promise<ParsedConnections> {
  const { connections, clients } = context.assets;

  if (!connections) return { connections: null };

  return {
    connections: connections.map((connection) => {
      const dumpedConnection = {
        ...connection,
        ...getFormattedOptions(connection, clients),
        ...(connection.enabled_clients && {
          enabled_clients: mapClientID2NameSorted(connection.enabled_clients, clients || []),
        }),
      };

      if (dumpedConnection.strategy === 'email') {
        ensureProp(connection, 'options.email.body');
        const connectionsFolder = path.join(context.basePath, constants.CONNECTIONS_DIRECTORY);
        const connectionName = sanitize(dumpedConnection.name);
        const html = dumpedConnection.options.email.body;
        const emailConnectionHtml = path.join(connectionsFolder, `${connectionName}.html`);

        log.info(`Writing ${emailConnectionHtml}`);
        fs.ensureDirSync(connectionsFolder);
        fs.writeFileSync(emailConnectionHtml, html);

        dumpedConnection.options.email.body = `./${connectionName}.html`;
      }

      return dumpedConnection;
    }),
  };
}

const connectionsHandler: YAMLHandler<ParsedConnections> = {
  parse,
  dump,
};

export default connectionsHandler;
