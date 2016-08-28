#!/usr/bin/env node

/*
* @Author: Manraj Singh
* @Date:   2016-08-24 12:21:30
* @Last Modified by:   Manraj Singh
* @Last Modified time: 2016-08-27 21:11:45
*/

'use strict';

const yargs = require('yargs');
const fs = require('fs');
const ora = require('ora');
const chalk = require('chalk');
const request = require('request');
const moment = require('moment');
const inquirer = require('inquirer');
const Table = require('cli-table');
const config = require('./config');
const league_ids = require('./league_ids');
const helpers = require('./helpers');

const getURL = helpers.getURL,
      standings = helpers.standings,
      refresh = helpers.refresh,
      getLeagueName = helpers.getLeagueName,
      fixturesHelper = helpers.fixturesHelper,
      printScores = helpers.printScores,
      scoresHelper = helpers.scoresHelper;

const headers = {
  'X-Auth-Token': config.API_KEY
};

const argv = yargs
  .usage('$0 <command>')
  .command('scores', 'Get scores of past and live fixtures', (yargs) => {
    const argv = yargs
      .usage('Usage: $0 scores [options]')
      .alias('l', 'live').describe('l', 'Live scores').boolean('l')
      .alias('t', 'team').describe('t', 'Select team')
      .example('sudo $0 scores -l')
      .argv;

    let url = undefined,
        team = (argv.t === undefined) ? '' : argv.t,
        timeFrameStart = undefined,
        timeFrameEnd = undefined;

    if(argv.l){
      timeFrameStart = moment().format("YYYY-MM-DD");
      timeFrameEnd = moment().add(1, "days").format("YYYY-MM-DD");
      url = `fixtures?timeFrameStart=${timeFrameStart}&timeFrameEnd=${timeFrameEnd}`;
    }
    else{
      timeFrameStart = moment().subtract(1, "days").format("YYYY-MM-DD");
      timeFrameEnd = moment().add(1, "days").format("YYYY-MM-DD");
      url = `fixtures?timeFrameStart=${timeFrameStart}&timeFrameEnd=${timeFrameEnd}`;
    }

    request({ "url": getURL(url), "headers": headers }, (err, res, body) => {
      if(err) {
        console.log(chalk.red("Sorry, an error occured"));
      }
      else {
        scoresHelper(argv.l, team, body);
      }
    });
  })
  .command('fixtures', 'Get upcoming and past fixtures of a league and team', (yargs) => {
    const argv = yargs
      .usage('Usage: $0 fixtures [options]')
      .alias('d', 'days').describe('t', 'Number of days')
      .alias('l', 'league').describe('l', 'League')
      .alias('t', 'team').describe('t', 'Team name or substring of it')
      .alias('n', 'next').describe('n', 'Next or upcoming matches').boolean('n')
      .example('sudo $0 fixtures -d 10 -t "Manchester United" -n')
      .argv;
      
    let days = argv.d || 10,
        league = argv.l,
        team = argv.t,
        time = (argv.n == true) ? "n" : "p";

    let timeFrame = `${time}${days}`;
    if(league !== undefined){
      if(league_ids[league] == undefined){
        throw new Error("No league found. Please check the League Code entered with the list `football list`.");
      }

      let id = league_ids[league].id,
          name = league_ids[league].caption;

      request({ "url": getURL(`competitions/${id}/fixtures?timeFrame=${timeFrame}`), "headers": headers }, (err, res, body) => {
        if(err) {
          console.log(chalk.red("Sorry, an error occured"));
        }
        else {
          fixturesHelper(league, name, team, body);
        }
      });
    }
    else {
      request({ "url": getURL(`fixtures?timeFrame=${timeFrame}`), "headers": headers }, (err, res, body) => {
        if(err) {
          console.log(chalk.red("Sorry, an error occured"));
        }
        else {
          fixturesHelper(league, undefined, team, body);
        }
      });
    }
  })
  .command('standings', 'Get standings of particular league', (yargs) => {
    const argv = yargs
      .usage('Usage: $0 standings [options]')
      .alias('l', 'league').describe('l', 'League to be searched').demand('l')
      .example('sudo $0 standings -l')
      .argv;

    let id = league_ids[argv.l].id;

    request({ "url": getURL(`competitions/${id}/leagueTable`), "headers": headers }, (err, res, body) => {
      if(err) {
        console.log(chalk.red("Sorry, an error occured"));
      }
      else {
        standings(body);
      }
    });
  })
  .command('lists', 'List of codes of various competitions', (yargs) => {
    const argv = yargs
      .usage('Usage: sudo $0 lists [options]')
      .alias('r', 'refresh').describe('r', 'Refresh league ids').boolean('r')
      .example('sudo $0 lists -r')
      .argv;

    if (argv.r) {
      request({ "url": getURL("competitions"), "headers": headers }, (err, res, body) => {
        if(err) {
          console.log(chalk.red("Sorry, an error occured"));
        }
        else {
          let newLeagueIDs = refresh(body);
          fs.writeFileSync(__dirname+'/league_ids.json', JSON.stringify(newLeagueIDs, null, 2), 'utf8');
        }
      });
    }
    else {
      let table = new Table({
        head: ['League', 'League Code'],
        colWidths: [ 40, 20]
      });

      for(let league in league_ids){
        table.push([ league_ids[league].caption, league]);
      }

      console.log(table.toString());
    }
  })
  .command('config', 'Change configuration and defaults', (yargs) => {
    const questions = [{
      type: 'input',
      name: 'API_KEY',
      message: 'Enter API KEY <leave blank incase unchanged>'
    }];

    inquirer.prompt(questions).then((answers) => {
      let obj = config;

      if (answers.API_KEY !== ''){
        obj.API_KEY = answers.API_KEY;
      }

      fs.writeFileSync(__dirname+'/config.json', JSON.stringify(obj, null, 2), 'utf8');
    });
  })
  .help('h')
  .alias('h', 'help')
  .argv;
