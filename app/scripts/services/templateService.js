'use strict';
const state = require('../../partial/state.html');
const mode = require('../../partial/mode.html');
const allowTransfer = require('../../partial/allowtransfer.html');
const deposit = require('../../partial/deposit.html');
const withdraw = require('../../partial/withdraw.html');
const transfer = require('../../partial/transfer.html');
const escape = require('../../partial/escape.html');
const adopt = require('../../partial/adopt.html');
const vote = require('../../partial/vote.html');
const createGalaxy = require('../../partial/creategalaxy.html');
const spawn = require('../../partial/spawn.html');
const setSpawnProxy = require('../../partial/setspawnproxy.html');
const configureKeys = require('../../partial/configurekeys.html');
const type = require('../../partial/type.html');

var templateService = {
    state: state,
    type: type,
    withdraw: withdraw,
    mode: mode,
    transfer: transfer,
    allowTransfer: allowTransfer,
    deposit: deposit,
    adopt: adopt,
    vote: vote,
    escape: escape,
    createGalaxy: createGalaxy,
    spawn: spawn,
    setSpawnProxy: setSpawnProxy,
    configureKeys: configureKeys
};

module.exports = templateService;
