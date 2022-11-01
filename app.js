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

const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const dateFormat = require('dateformat');

require('dotenv').config();

const accessEnv = require('./src/helpers/accessEnv');
const stringHelper = require('./src/helpers/stringHelper');
const FileManager = require('./src/models/FileManager');
const applicationFactory = require('./src//helpers/ApplicationFactory');
const { exit } = require('process');


const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/layout');
app.use(expressLayouts);
app.use(express.static('public'));

app.use(express.json());
app.use(express.urlencoded({extended: true}));

/**
 * The method get the time long between from star batch time and latest 
 * labeled panel by the laser machine.
 * 
 * @param {* Numeric value in millisecons } diffirenceMs 
 * @returns String value formated as Day(s) hours:minutes:seconds
 */
const timeDiffCalc = (diffirenceMs) => {
    let diffInMilliSeconds = diffirenceMs;

    // calculate days
    const dayMillis = 1000 * 60 * 60 * 24;
    const days = Math.floor(diffirenceMs / dayMillis);
    diffInMilliSeconds -= days * dayMillis;

    // calculate hours
    const hourMillis = 1000 * 60 * 60;
    const hours = Math.floor(diffirenceMs / hourMillis) % 24;
    diffInMilliSeconds -= hours * hourMillis;

    // calculate minutes
    const minutesMillis = 1000 * 60;
    const minutes = Math.floor(diffirenceMs / minutesMillis) % 60;
    diffInMilliSeconds -= minutes * minutesMillis;

    // calculate seconds
    const secondsMillis = 1000;
    const seconds = Math.round(diffirenceMs / secondsMillis) % 60;
    diffInMilliSeconds -= seconds * secondsMillis;

    let output = '';

    if(parseInt(days) > 0) {
        output = output.concat(`${days} day(s) `);
    }

    if(parseInt(hours) > 0 || hours === 0) {
        output = output.concat(`${hours}:`);
    }

    if(parseInt(minutes) > 0 || minutes === 0) {
        let mins = ("0" + minutes).slice(-2);
        output = output.concat(`${mins}:`);
    }

    if(parseInt(seconds) > 0 || seconds === 0) {
        let sec = ("0" + seconds).slice(-2);
        output = output.concat(`${sec}`);
    }

    return output;
}

/**
 * In the Redis uses a ZRANGE key to store 
 * generated patters and PMJ serials numbers by common entry for
 * particular batch (order). It is implemented for avoid dublicates that apearing 
 * from machine counter.
 * 
 * The entry of the ZRANGE has common value of the PMJ standard specification when
 * only the date time stamp changed. Simply difference in the date.
 * 
 * The method looks for expired keys to delete them
 */
const removeLastMonthZRangeKeys = async() => {
    
    let currentDateObject = new Date();
    let currentYear = currentDateObject.getFullYear();
    let minesMonth = ("0" + (currentDateObject.getMonth() - 1)).slice(-2);

    // preparing the redis key query
    let redisKeyValue = "VR";
    redisKeyValue = redisKeyValue.concat("*");
    redisKeyValue = redisKeyValue.concat(("" + currentYear).slice(-2)).concat(minesMonth)
    redisKeyValue = redisKeyValue.concat("*");

    await applicationFactory.redisManager.getAllKeys(redisKeyValue).then(async response => {
        if(response != null) {
            let keysArray = response;
            if(typeof keysArray == 'object' && keysArray.length > 0) {
                const delResult = await applicationFactory.redisManager.deleteZRANGEKeys(keysArray);
//                console.log(delResult);
            }
        }
    })
    .catch(err => {
        console.log(err);
    });
}
removeLastMonthZRangeKeys();

/**
 * This is the UI data pusher which displays the panel board serial number and patterns dublicates
 * if exists.
 * 
 * @param {* String PMJ Datamatrix value without bin's resistors; Static length 16 chars} nonBinsPMJ
 * @param {* String Internal manufactory code} smacode
 * @param {* String Full length of the PMJ of PCBA} pmjEntry
 * @param {* String array of patters codes} patternsListArray
 */
const pushPatternDublicate = async (nonBinsPMJ, smacode, pmjEntry, patternsListArray = []) => {
    patternsListArray.forEach(async (patternItem) => {
        await applicationFactory.redisManager.isNotDuplicatedValue(nonBinsPMJ, smacode, patternItem).then(response => {
            // 0 [Numeric NULL] - a similr entry is exists.
            if(response == 0) {
                let objectData = {
                    title: pmjEntry,
                    duplicatePMJ: false,
                    duplicatePatters: true,
                    createdAt:  dateFormat(parseInt(Date.now()), DATETIME_FORMAT)
                };
                let duplicatedVals = applicationFactory.getDublicatedValues();
                duplicatedVals.push(objectData);
                applicationFactory.setDublicatedValues(duplicatedVals);
            }
        });
    });
};

const DATETIME_FORMAT = accessEnv('DATETIME_FORMAT', 'dd.mmm.yy HH:MM:ss');
const INTERVAL_DELAY = accessEnv('INTERVAL_DELAY_MS', 3000);

/**
 * This is the basic method of the web application.
 * The method is the loop function that works with predefined interval value (INTERVAL_DELAY) and
 * communicates with full stack of envirenment: files - read and parse; Redis DB - read/write; rewrite UI data;
 */
const startHoneypotTrap = () => {
    const fileManager = new FileManager(accessEnv('TRACE_TMP_DIR', __dirname), accessEnv('TRACE_SRC_DIR', __dirname), '.txt');


    let interval = setInterval(async () => {
        // 1. get File Array from directory trap
        await fileManager.readFilesFromTempDirectory();
        let fileList = fileManager.getTempFilesList();

        if(fileList.length > 0) {
            // 2. get order number from each file in list
            let file = fileList[0];

            await fileManager.readFileStream(file).then(async (stringBuffer) => {
                // console.log('--- Debug readFileStream ---');
                // console.log('LinesBuffer: ', stringBuffer);

                let pmjEntry = '';
                let nonBinsPMJ = '';
                let laserMachineID = '';
                let patternsHash = '';
                let patternsListArray = [];
                let smacode = '';
                let orderNumber = '';

                if(stringBuffer.length > 0) {
                    await fileManager.getPMJLineEntry(stringBuffer[0]).then(string => {
                        pmjEntry = string;
                    });
                    console.log('PMJ Entry: ', pmjEntry);

                    await fileManager.getNonBinsPMJ(pmjEntry).then(string => {
                        nonBinsPMJ = string;
                    });
                    console.log('nPMJEntry: ', nonBinsPMJ);

                    await fileManager.getLaserMachineID(stringBuffer[0]).then(string => {
                        laserMachineID = string;
                    });
                    // console.log('Laser Machine ID: ', laserMachineID);

                    await fileManager.getPatternsHash(stringBuffer).then(hashString => {
                        patternsHash = hashString;
                    });
                    // console.log('Patterns hash: ', patternsHash);

                    await fileManager.getPatternsListArray(stringBuffer).then(resultList => {
                        patternsListArray = resultList;
                    });
                    // console.log('-- 1. Patterns List Array: ', patternsListArray);

                    smacode = fileManager.getSMANumberFromLine(stringBuffer[0]);
                    console.log('SMA code: ', smacode);
                    
                    await fileManager.getOrderNumberFromLine(stringBuffer[0]).then(string => {
                        orderNumber = string;
                    });
                    // console.log('Order Number: ', orderNumber);
                }

                if(stringBuffer.length == 0) {
                    console.log('Trace file Empty');
                    throw new Error(`Trace file - ${file}  is empty.`);
                }

                if(!stringHelper.isEmpty(smacode) && !stringHelper.isEmpty(orderNumber)) {
                    await applicationFactory.redisManager.getHashKeyEntry(orderNumber)
                    .then(async (exists) => {

                        // set order number
                        applicationFactory.setOrderNumber(orderNumber);

                        if(exists == null) {
                            // 5. create new entry
                            const newOrderEntry = await applicationFactory.redisManager.createHashEntry({hashKey: orderNumber, smacode});
                            // update global variables for HTML
                            // console.log('New Order Entry Created: ', newOrderEntry);
                            const {counter, createdAt, updatedAt} = newOrderEntry;
                            applicationFactory.setBoardsCounter(counter);
                            applicationFactory.setCreatedAt(createdAt);
                            applicationFactory.setUpdatedAt(updatedAt);
                            applicationFactory.setSMACode(smacode);
                        }
                        if(exists != null) {
                            // 6. increment existed counter by one
                            const incrementedOrderCounter = await applicationFactory.redisManager.incrementHashKey(orderNumber, 'counter', 1);
                            const {counter, createdAt, updatedAt} = incrementedOrderCounter;
                            applicationFactory.setBoardsCounter(counter);
                            applicationFactory.setCreatedAt(createdAt);
                            applicationFactory.setUpdatedAt(updatedAt);
                            applicationFactory.setSMACode(smacode);
                            // console.log('Incremented Order: ', incrementedOrderCounter);
                        }

                        let isNotPMJDublicated = 0;
                        await applicationFactory.redisManager.isNotDuplicatedValue(nonBinsPMJ, smacode, pmjEntry).then(response => {
                            isNotPMJDublicated = response;
                        });
                        // console.log('isNotPMJDublicated: ', isNotPMJDublicated);
						
                        if(isNotPMJDublicated == 0)  {
                            let objectData = {
                                title: pmjEntry,
                                duplicatePMJ: true,
                                duplicatePatters: false,
                                createdAt: dateFormat(parseInt(Date.now()), DATETIME_FORMAT)
                            };
                            let duplicatedVals = applicationFactory.getDublicatedValues();
                            duplicatedVals.push(objectData);
                            applicationFactory.setDublicatedValues(duplicatedVals);
                        }

                        // validate is unique patterns label
                        await pushPatternDublicate(nonBinsPMJ, smacode, pmjEntry, patternsListArray);
                        
                    }).finally(() => {
                        // move file
                        fileManager.move(file);
                    });
                }
            })
            .catch(err => {
                // if not parsed
                console.log(err);
                fileManager.move(file);
            });
        }

    }, INTERVAL_DELAY);
}
startHoneypotTrap();

/**
 * Express GET query to render the main page to display latest state of process. 
 */
app.get('/', async (req, res) => {    
    const createdAt = dateFormat(parseInt(applicationFactory.getCreatedAt()), DATETIME_FORMAT);
    const updatedAt = dateFormat(parseInt(applicationFactory.getUpdatedAt()), DATETIME_FORMAT);
    const boardsCounter = applicationFactory.getBoardsCounter();
    const orderNumber = applicationFactory.getOrderNumber(); 
    const smacode = applicationFactory.getSMACode();
    const estimatedTime = timeDiffCalc(parseInt(applicationFactory.getUpdatedAt()) - parseInt(applicationFactory.getCreatedAt()));
    
    let gridItems = [];
    await applicationFactory.redisManager.getAllKeys('[0-9]??????').then(async (keys) => {

        // sort hashKeys by DESC 
        let orderHashKeys = keys.sort((a, b) => parseInt(b) - parseInt(a));

        if(orderHashKeys.length > 0) {
            for(let i = 0; i < orderHashKeys.length; i++) {
                let orderHashKey = orderHashKeys[i];
                let orderValue = await applicationFactory.redisManager.getHashKeyEntry(orderHashKeys[i]);
                let timePeriod = timeDiffCalc(parseInt(orderValue.updatedAt) - parseInt(orderValue.createdAt));
                orderValue = {...orderValue, createdAt: dateFormat(parseInt(orderValue.createdAt), DATETIME_FORMAT)};
                orderValue = {...orderValue, updatedAt: dateFormat(parseInt(orderValue.updatedAt), DATETIME_FORMAT)};
                // orderValue = {...orderValue, modifiedAt: dateFormat(parseInt(orderValue.modifiedAt), DATETIME_FORMAT)};
                orderValue = {...orderValue, modifiedAt: parseInt(orderValue.modifiedAt)};
                orderValue = {...orderValue, timePeriod: timePeriod};
                gridItems.push({...orderValue, hashKey: orderHashKey});
            }
        }
    })
    .catch(err => {
        console.log(err);
    });    

    let dublicatedValues = applicationFactory.getDublicatedValues();
    res.render('index', {boardsCounter, orderNumber, smacode, createdAt, updatedAt, estimatedTime, gridItems, dublicatedValues});
});

// update current counter
app.post('/', async (req, res, next) => {
    const {hashKey, formCounterDest} = req.body;
    const incrementValue = parseInt(formCounterDest);
    if(typeof incrementValue === 'number' && incrementValue != 0) {
        const editedResult = await applicationFactory.redisManager.incrementFormHashKey(hashKey, formCounterDest);
        const {counter, smacode, createdAt, updatedAt} = editedResult;
    
        applicationFactory.setOrderNumber(hashKey);
        applicationFactory.setSMACode(smacode);
        applicationFactory.setBoardsCounter(counter);
        applicationFactory.setCreatedAt(createdAt);
        applicationFactory.setUpdatedAt(updatedAt);    
    }

    res.redirect('/');
});

/**
 * Ability to predefine manufacture order number
 */
app.post('/create/custom/hash', async (req, res, next) => {
    const {hashKey, smacode} = req.body;
    const createdHashKey = await applicationFactory.redisManager.createHashEntry({hashKey, smacode});
    res.status(200).send(`<p>Custom HASH KEY is created: ${createdHashKey}</p>`);
});

/**
 * GET query is allows to update the counter in the Redis directly by the manufacture order number (hashKey).
 * 
 * Uses for administrative purposes.
 */
app.get('/edit/:hashKey/:countVal', async (req, res) => {
    const {hashKey, countVal} = req.params;
    console.log('hashKey: ', hashKey);
    console.log('countVal: ', countVal);

    const updateResult = await applicationFactory.redisManager.updateHashKey(hashKey, countVal);
    
    res.redirect('/');
});

/**
 * Allows to remove particular throw the expiration function in RedisDB
 * 
 * GET query example: http://loclhost:PORT/1324330/?days=5&hour=2&min=1&sec=0
 * For administrative purposes only. 
 */
app.get('/expire/:hashKey/', async (req, res) => {
    const {hashKey} = req.params;
    const {day, hour, min, sec} = req.query;

    let calculatedExpire = 0;

    if(!stringHelper.isBlank(day)) {
        const calcDay = parseInt(day) * (60 * 60 * 24);
        calculatedExpire += calcDay;
    }

    if(!stringHelper.isBlank(hour)) {
        const calcHour = parseInt(hour) * (60 *60);
        calculatedExpire += calcHour;
    }

    if(!stringHelper.isBlank(min)) {
        const calcMin = parseInt(min) * 60;
        calculatedExpire += calcMin;
    }

    if(!stringHelper.isBlank(sec)) {
        calculatedExpire += parseInt(sec);
    }

    await redisManager.expireHashKey(hashKey, calculatedExpire).then(result => {
        if(result === 1) {
            console.log('Order number %s  expired in %d seconds.', hashKey, calculatedExpire);
        }
    });

    res.redirect('/');
});

app.get('/flushdublicates', (req, res) => {
    let dublicates = applicationFactory.getDublicatedValues();
    if(dublicates.length > 0) {
        applicationFactory.flushDublicatedValues();
    }
    res.redirect('/');
});


const PORT = accessEnv('APP_PORT', 8088);

app.listen(PORT, () => {
    console.log(`Laser boards counter works on http://localhost:${PORT}`);
});
