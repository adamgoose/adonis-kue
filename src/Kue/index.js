'use strict';

const fs = require('fs');
const kue = require('kue');
const path = require('path');
const CatLog = require('cat-log');
const logger = new CatLog('adonis:kue');

/**
 * @module Kue
 * @description Interface to the Kue job queue library
 */
class Kue {
  constructor (Helpers, Config) {
    this.logger = new CatLog('adonis:kue');
    this.jobsPath = path.join(Helpers.appPath(), 'Jobs');
    this.jobsPath = path.normalize(this.jobsPath);
    this.connectionSettings = Config.get('kue.connection');
    if (!this.connectionSettings) {
      throw new Error('Specify connection under config/kue file');
    }
    this.instance = null;
    this.registeredJobs = [];
  }

  /**
   * @returns {*}
   * @public
   */
  getInstance () {
    if (!this.instance) {
      this.instance = kue.createQueue(this.connectionSettings);
    }
    return this.instance;
  }

  dispatch(key, data) {
    const instance = this.getInstance();
    return instance.create(key, data).save(err => {
       if( err ) console.log( err );
    });
  }

  /**
   * Start queue to process all jobs defined in app/Jobs
   *
   * @public
   */
  listen () {
    // this.log.info('Starting queue listener %s:%s', host, port)
    const instance = this.getInstance();

    try {
      const jobFiles = fs.readdirSync(this.jobsPath);

      jobFiles.forEach(file => {
        const filePath = path.join(this.jobsPath, file);
        const Job = require(filePath);

        // Every job must expose a key
        if (!Job.key) {
          throw new Error(`No key found for job: ${filePath}`);
        }

        // If job concurrency is not set, default to 1
        if (Job.concurrency === undefined) {
          Job.concurrency = 1;
        }

        // If job concurrecny is set to an invalid value, throw error
        if (typeof Job.concurrency !== 'number') {
          throw new Error(`Job concurrency value must be a number but instead it is: <${Job.concurrency}>`);
        }

        this.registeredJobs.push(Job);

        // Register job handler
        this.instance.process(Job.key, Job.concurrency, Job.handle);
      });

      this.logger.info('kue job listener started for %d jobs', this.registeredJobs.length);

    } catch (e) {
      // If the directory isn't found, log a message and exit gracefully
      if (e.code === 'ENOENT') {
        this.logger.info('The jobs directory <%s> does not exist. Exiting.', this.jobsPath);
      } else {
        throw e;
      }
    }
  }
}

module.exports = Kue;
