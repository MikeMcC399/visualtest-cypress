const axios = require('axios').default;
const { v4: uuidv4 } = require('uuid');
const fs = require("fs");
const toolkitScripts = require('@smartbear/sbvt-browser-toolkit');
const package_json = require('./package.json');
const cwd = process.cwd();
const path = require("path");

const pino = require('pino')
const logger = pino({transport: {target: 'pino-pretty'}});
logger.level = 'warn' ;// warn will be the default level for debug logs
//set debug flag on visualTest.config.js file by including: PINO_LOG_LEVEL: 'trace'
//options are [trace, debug, info, warn, error, fatal] in that order

let config = {};

//TODO work on this file if cypress is not a devDependency, and a regular it throws errors...


let usersCypress;
try {
  const packageFile = fs.readFileSync(path.resolve(path.dirname(require.resolve('cypress', {paths: [cwd]})), 'package.json'))
  usersCypress = JSON.parse(packageFile.toString());
  if (!usersCypress.version) {
    usersCypress.version = "10.0.0.failure" // #TODO improve this if cypress folder isnt found (when the folder isnt a devDependency)
    logger.warn('failed to find cypress assuming it is v10+')
  }
} catch (err) {
  logger.warn("catch")
  usersCypress.version = "10.0.0" // #TODO improve this if cypress folder isnt found
  console.log(err)
  logger.warn(err.message)
}

function makeGlobalRunHooks() {
  return {
    'task': {
      async postTestRunId () { //cy.task('postTestRunId') to run this code
        if (!config.testRunId && !config.fail) {//all this only needs to run once
          const fileName = 'visualTest.config.js';
          const sessionId = uuidv4();
          const fullPath = `${process.cwd()}/${fileName}`;
          if (fs.existsSync(fullPath)) {
            logger.trace(fileName + ' has been found');
            config = {...require(fullPath)}; //write the VT config file into config object
          } else {
            config.fail = true;
            logger.fatal('The path ' + fullPath + ' was not found');
            return config;
          }

          if (config.PINO_LOG_LEVEL) {
            logger.level = config.PINO_LOG_LEVEL //overwrite if the user includes a pino flag in VTconf
          } else if (config.log) {
            logger.level = config.log
          }

          if (!config.projectToken) { //check to make sure user added a projectToken
            config.fail = true;
            logger.fatal(`Please add **module.exports = { projectToken: 'PROJECT_TOKEN' }** to your visualTest.config.js file`);
            return config;
          }

          if (config.projectToken.includes("_")) { //check to make sure the user changed it from the default
            config.fail = true;
            logger.fatal(`Please insert your actual projectToken`);
            return config;
          }

          if (!config.projectToken.split('/')[1]) { //check to make sure user added the auth part(~second-half) of projectToken
            config.fail = true;
            logger.fatal(`Please add your full projectToken for example -> ** projectToken: 'xxxxxxxx/xxxxxxxxxxxx' **`);
            return config;
          }

          logger.trace('config.projectToken: ' + config.projectToken);
          config.projectId = config.projectToken.split('/')[0]; //take the first ~half to get the projectId
          logger.trace('config.projectId: ' + config.projectId);

          axios.defaults.headers.common['Authorization'] = `Bearer ${config.projectToken}`;
          logger.trace(`axios.defaults.headers.common['Authorization']: ` + axios.defaults.headers.common['Authorization']);

          config.sessionId = sessionId;
          logger.trace('config.sessionId: ' + config.sessionId);

          if (!config.testRunName) {  //if testRunName not defined---testRunName will be the sessionId
            config.testRunName = sessionId;
          }
          logger.trace('config.testRunName: ' + config.testRunName);

          if (config.apiHost) {
            logger.debug('Found config.apiHost')
            config.url = config.apiHost
            logger.warn('overwritten URL is: ' + config.url);
          } else{
            config.url = 'https://api.visualtest.io';
            logger.trace('URL is: ' + config.url);
          }
          config.websiteUrl = config.url.replace('api', 'app');
          logger.trace('config.websiteUrl: ' + config.websiteUrl);

          config.cypressVersion = usersCypress.version
          try {
            const postResponse = await axios.post(`${config.url}/api/v1/projects/${config.projectId}/testruns`, {
              testRunName: config.testRunName,
              sdk: 'cypress',
              sdkVersion: `${package_json.version}/c${usersCypress.version}`
            })
            config.testRunId = postResponse.data.testRunId;
            logger.debug('config.testRunId: ' + config.testRunId);
          } catch (error) {
            config.fail = true;
            logger.fatal(`Error with creating testRun: %o`, error.message);
            logger.trace(`Full error with creating testRun: %o`, error);
            return config;
          }
          config.fail = false; //no errors in generating testRunId
          logger.trace('—————————————————Successfully created a testRunId—————————————————');
        }
        return config;
      },
      async logger ({type, message}) { //this task is for printing logs to node console from the custom command
        type === 'fatal'  ? logger.fatal(message) :
            type === 'error'  ? logger.error(message) :
                type === 'warn'   ? logger.warn(message)  :
                    type === 'info'   ? logger.info(message)  :
                        type === 'debug'  ? logger.debug(message) :
                            type === 'trace'  ? logger.trace(message) :
                                logger.warn('error with the logger task')
        return null
      },
      async loadScripts () {
        return toolkitScripts
      }
    },
    'after:run':
        async () => {
          if (config.fail === false) {
            try {//this just GETs test results using the testRunId
              const response = await axios.get(`${config.url}/api/v1/projects/${config.projectId}/testruns/${config.testRunId}/images`);
              logger.info(`API image URL: ${config.url}/api/v1/projects/${config.projectId}/testruns/${config.testRunId}/images`); // this is useless right now, needs to be 'logger.fatal' to be seen TODO add the ability to check environment variables for default logger level maybe?
              console.log(`Your ${response.data.page.totalItems} captures can be found at: ${config.websiteUrl}/projects/${config.projectId}/testruns`);
            } catch (error) {
              console.error(error.response.data);
            }
          } else if (config.fail === true) {
            logger.fatal('There were issues with VisualTest. Check above logs.');
          } else {
            console.log('There were no VisualTest captures taken.');
          }
        },
  };
}

function makePluginExport() {
  let setupNodeEventState = false;
  return function pluginExport(pluginModule) {
    if (pluginModule.exports.e2e && pluginModule.exports.e2e.setupNodeEvents) {
      setupNodeEventState = true; //for not throwing an error if the user doesn't have setupNodeEvents SBVT-335

    }
    const pluginModuleExports = pluginModule.exports.e2e
        ? pluginModule.exports.e2e.setupNodeEvents
        : pluginModule.exports;
    const setupNodeEvents = async function(...args) {
      const globalHooks = makeGlobalRunHooks();
      const [origOn] = args;

      for (const [eventName, eventHandler] of Object.entries(globalHooks)) { // for-loop to add all functions on this file
        origOn.call(this, eventName, eventHandler);
      }
      if (setupNodeEventState) {
        //Needed for grabbing functions in cypress.config.js file
        await pluginModuleExports(grabUserFunctions);
      }
      function grabUserFunctions(eventName, handler) {//Needed for grabbing functions in cypress.config.js file
        return origOn.call(this, eventName, handler);
      }
    };
    if (pluginModule.exports.e2e) {
      pluginModule.exports.e2e.setupNodeEvents = setupNodeEvents;
    } else {
      pluginModule.exports = setupNodeEvents;
    }
  };
}

module.exports = makePluginExport({});