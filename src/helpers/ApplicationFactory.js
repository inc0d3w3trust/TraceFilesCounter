/**
 * Copyright 2021 r3c1us0@protonmail.ch
 * Permission to use, copy, modify, and/or distribute this software for any purpose with
 * or without fee is hereby granted, provided that the above copyright notice and this permission 
 * notice appear in all copies. 
 * 
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO
 * THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS.
 * IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT,
 * OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
 * WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
 * ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

const RedisManager = require('../models/RedisManager');
const accessEnv = require('../helpers/accessEnv');
const redisHost = accessEnv('REDIS_HOST', '127.0.0.1');
const redisPort = accessEnv('REDIS_PORT', '6379');
const redisDatabase = accessEnv('REDIS_DATABASE', '');
const redisAuth = accessEnv('REDIS_AUTH', '');

class ApplicationFactory {
    
    constructor() {
        this._orderNumber = 0;
        this._boardsCounter = 0;
        this._createdAt = 0;
        this._updatedAt = 0;
        this._smacode = 0;
        this._orderHashKeys = [];
        this._duplicatedValues = [];

        this.redisManager = new RedisManager(redisHost, redisPort, redisAuth, redisDatabase);
        
        if(!ApplicationFactory._instance) {
            ApplicationFactory._instance = this;
        }
        return ApplicationFactory._instance;
    }

    static getInstance() {
        return this._instance;
    }

    setOrderNumber(orderNumber) {
        this._orderNumber = orderNumber;
    }

    getOrderNumber () {
        return this._orderNumber;
    }

    setBoardsCounter(boardsCounter) {
        this._boardsCounter = boardsCounter;
    }

    getBoardsCounter(boardsCounter) {
        return this._boardsCounter;
    }

    setCreatedAt(createdAt) {
        this._createdAt = createdAt;
    }

    getCreatedAt() {
        return this._createdAt;
    }

    setUpdatedAt(updatedAt) {
        this._updatedAt = updatedAt;
    }

    getUpdatedAt() {
        return this._updatedAt;
    }

    setSMACode(smacode) {
        this._smacode = smacode;
    }

    getSMACode() {
        return this._smacode;
    }

    getDublicatedValues() {
        return this._duplicatedValues;
    }

    setDublicatedValues(duplicatedValues) {
        this._duplicatedValues = duplicatedValues;
    }

    flushDublicatedValues() {
        this._duplicatedValues = [];   
    }
}

const applicationFactory = new ApplicationFactory()

module.exports = applicationFactory;