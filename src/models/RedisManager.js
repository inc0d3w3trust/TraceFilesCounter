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

const { resolve } = require('path');
const redis = require('redis');
const { promisify } = require('util');
const stringHelper = require('../helpers/stringHelper');

class RedisManager {
    constructor(host='127.0.0.1', port='6379', auth='', database='') {
        const redisOptions = {
            port: port, 
            host: host,
            password: auth,
            maxReconnectionAttempts: 10,
            parser: 'javascript',
            return_buffer: false
        }

        console.log('RedisManager constructor: auth = ', auth);

        this.client = redis.createClient(redisOptions);

        this.hexistsAsync = promisify(this.client.hexists).bind(this.client);
        this.hsetAsync =  promisify(this.client.hset).bind(this.client);
        this.hmsetAsync = promisify(this.client.hmset).bind(this.client);
        this.hgetallAsync = promisify(this.client.hgetall).bind(this.client);
        this.hincrbyAsync = promisify(this.client.hincrby).bind(this.client);
        this.zaddAsync = promisify(this.client.zadd).bind(this.client);
        this.del = promisify(this.client.del).bind(this.client);

        // if(!stringHelper.isEmpty(auth)) {
        //     this.authClient(auth, (err) => {
        //         if(err) {
        //             throw new Error(`Auth on server in error ${err}`);
        //         }
        //     });
        // }

    }

    createClient(redisOptions, auth, databaseName) {
        const redisClient = redis.createClient(redisOptions);

        return new Promise( (resolve, reject) => {
                redisClient.auth(auth, (err) => {
                    if (err)
                        reject(err);

                    redisClient.select(databaseName, (err) => {
                        if (err)
                            reject(err);

                        resolve(redisClient);
                    });
                });
            });
    }

    async deleteZRANGEKeys(keysArray) {
        return new Promise( async (resolve, reject) => {
            let deleteKeys = "DEL ";
            for(var i = 0; i < keysArray.length; i++) {
                deleteKeys = deleteKeys.concat(" \"" + keysArray[i] + "\"");
            }
            const result = await this.del(keysArray, (error, reply) => {
                return reply;
            });
            resolve(result);
        });
    }

    async isHashExists({hashKey, field}) {        
        return new Promise( async (resolve, reject) => {
            const result = await this.hexistsAsync(hashKey, field);
            resolve(parseInt(result));
        });
    }

    async createHashEntry({hashKey, smacode}) {

        const dateNow = Date.now();
        await this.hmsetAsync(hashKey, {
            counter: 1,
            smacode: smacode,
            createdAt: dateNow,
            updatedAt: dateNow,
            modifiedAt: 0
        });

        return await this.hgetallAsync(hashKey);
    }

    async getHashKeyEntry(hashKey) {
        return new Promise(async (resolve, reject) => {
            const result = await this.hgetallAsync(hashKey);
            resolve(result);
        });
    }

    async incrementHashKey(hashKey, counter, valNum) {

        const dateNow = Date.now();
        await this.hsetAsync(hashKey, "updatedAt", dateNow);
        await this.hincrbyAsync(hashKey, counter, valNum);
        return await this.hgetallAsync(hashKey);
    }

    async incrementFormHashKey(hashKey, valNum) {

        const dateNow = Date.now();
        await this.hincrbyAsync(hashKey, "counter", valNum);
        await this.hsetAsync(hashKey, "modifiedAt", dateNow);
        return await this.hgetallAsync(hashKey);
    }

    async updateHashKey(hashKey, countVal) {
        const dateNow = Date.now();
        await this.hmsetAsync(hashKey, "modifiedAt", dateNow, "counter", countVal);
        return await this.hgetallAsync(hashKey);
    }

    async getAllKeys(pattern = "*") {
        return new Promise(async (resolve, reject) =>{
            this.client.keys(pattern, (err, keys) => {
                if(err) return reject(err);

                return resolve(keys);
            });            
        });
    }

    async expireHashKey(hashKey, seconds) {
        return new Promise(async (resolve, reject) =>{

            await this.getHashKeyEntry(hashKey).then(async (entry) => {
                if(entry !== null) {
                    this.client.expire(hashKey, seconds, (err, reply) => {
                        if(err) reject(err);
                        resolve(reply);
                    });
                }
                else {
                    resolve(false);
                }
            })
        });
    }

    /**
     * 
     * @param {String} nonBinsPMJ 
     * @param {*} smacode 
     * @param {*} patternsHash 
     * @returns 
     */
    async isNotDuplicatedValue(nonBinsPMJ, smacode, patternsHash) {
        const args = [nonBinsPMJ, smacode, patternsHash];
        
        return new Promise(async (resolve, reject) =>{
            const result = await this.zaddAsync(nonBinsPMJ, parseInt(smacode), patternsHash);
            resolve(result);
        });
    }

    
}

module.exports = RedisManager;