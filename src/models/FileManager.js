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

const fs = require('fs');
const { promisify } = require('util');
const path = require('path');
const lineReader = require('line-reader');
const crypto = require('crypto');
const asscessEnv = require('../helpers/accessEnv');
const StringHelper = require('../helpers/stringHelper');

const readDirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);
const mkdirAsync = promisify(fs.mkdir);
const renameAsync = promisify(fs.rename);
const copyFileAsync = promisify(fs.copyFile);
const unlinkAsync = promisify(fs.unlink);

class FileManager {
    constructor(tempDirPath, sourceDirPath, fileExtension='') {
        this.dirSeparator = '/';
        this.tempDirFiles = new Array();
        this.tempDirPath = this.normalizePath(tempDirPath);
        this.sourceDirPath = sourceDirPath;
        this.fileExtension = fileExtension;
    }

    normalizePath(directoryPath) {
        const search = /\\/;
        const replacer = new RegExp(search, 'g');
        const normalizedDir = directoryPath.replace(replacer, '/');
        const lastSeparator = normalizedDir.lastIndexOf('/');
        if(lastSeparator <  normalizedDir.length - 1) {
            return normalizedDir;
        }
        else {
            return normalizedDir.substring(0, lastSeparator);
        }
    }

    async getDirectoryFiles(directoryPath, extension='') {
        var filesVals = [];
        return new Promise(async (resolve, reject) => {
            await readDirAsync(directoryPath, (err, files) => {
                if(err) {
                    reject(err);
                }
    
                if(!StringHelper.isEmpty(extension)) {
                    filesVals = files.filter(file => {
                        if(path.extname(file) == extension) {
                            return file;
                        }
                    });
                    resolve(filesVals);
                }
                else {
                    resolve(files);
                }
            });    
        });
    }

    async readFilesFromTempDirectory() {
        if(this.tempDirFiles.length > 0) {
           this.tempDirFiles = new Array(); 
        }

        await this.getDirectoryFiles(this.normalizePath(this.tempDirPath), this.fileExtension)
        .then(files => {
            files.forEach(file => {
                this.tempDirFiles.push(file);
            });
        })
        .catch(err => {
            console.log(err);
        });
    }

    getTempFilesList() {
        return this.tempDirFiles;
    }

    async readFileStream(filename) {
        return new Promise((resolve, reject) => {
            const fullFilePath = path.join(this.tempDirPath, filename);
			let linesBuffer = [];
			
			lineReader.eachLine(fullFilePath, line => {
				linesBuffer.push(line);
			}, err => {
				if(err) reject(err);
				resolve(linesBuffer);
			});
		});
	}		
	
    async getPMJLineEntry(line) {
        const splitter = /\W/;
        const search = /;[a-zA-Z]{2}\d{8}.*?;/;
        const regexp = new RegExp(search, 'gm');
        let matches = regexp.exec(line);

        const rarePMJSearch = /;00\w+([0-9]{5});/;
        const rarePMJRegex = new RegExp(rarePMJSearch, 'gm');
        let rarePMJMatches = rarePMJRegex.exec(line);
        let result = null;

        if(matches != null) {
            if(matches[0].length >= 16) {
                result = matches[0].split(splitter).join('');
            }
        }

        if(rarePMJMatches != null)  {
            if(rarePMJMatches[0].length == 49) {
                if(rarePMJMatches[1].startsWith('9')) {
                    result = rarePMJMatches[0].split(splitter).join('');
                }
            }
        }

        return result;
    }

    async getNonBinsPMJ(string) {
        let result = null;
        if(string.length > 16) {

            if(string.startsWith("00")) {
                result = string.replace(/^\d{2}/, 'VR');
                result = result.substring(0, 42);
            }

            if(string.startsWith("VR")) {
                result = string.substring(0, 16);
            }
        }

        if(string == 16) {
            result = string;
        }

        return result;
    }

    async getLaserMachineID(string) {
        let result = null;
        if(string.length > 0) {
            let matches = string.split(';');
            if(matches.length > 0) {
                const splitter = /\s/;
                result = matches[matches.length -1].split(splitter).join('');
            }
        }

        return result;
    }

    async getPatternsHash(stringBuffer) {
        let joinPatterns = '';
       if(Array.isArray(stringBuffer) && stringBuffer.length >= 1)  {
           for(let i = 1; i < stringBuffer.length; i++) {
               joinPatterns += stringBuffer[i].split(';')[2];
           }

           joinPatterns = crypto.createHash('md4').update(joinPatterns, 'utf8').digest('hex');
       }

       return joinPatterns;
    }

    async getPatternsListArray(stringBuffer) {
        let result = [];
        if(Array.isArray(stringBuffer) && stringBuffer.length >= 1)  {
            for(let i = 1; i < stringBuffer.length; i++) {
                result.push(stringBuffer[i].split(';')[2]);
            }
        } 

        return result;
    }

    async getOrderNumberFromLine(line) {
        const search = /[0-9]{6,7}?-/;
        const regexp = new RegExp(search, 'gm');
        let matches = regexp.exec(line);
        let result = '';
        return new Promise((resolve, reject) => {
            if(matches !== null) {
                if(matches[0].length > 0) {
                    const splitter = /\D/;
                    result = matches[0].split(splitter).join('');
                    resolve(result);
                }
            }
            reject(new Error(`Order number not found in line - ${line}`));
        });
    }
    
    getSMANumberFromLine(line) {
        const search = /-[0-9]{7};?/;
        const regexp = new RegExp(search, 'gm');
        let matches = regexp.exec(line);
        let result = '';

        if(matches !== null) {
            if(matches[0].length > 0) {
                const splitter = /\D/;
                result = matches[0].split(splitter).join('');
            }
        }
        return result;
    }

    async moveFile(oldPath, newPath) {
        // 1. create the destination directory
        // Set the 'recursive' option to 'true' to create all the subdirectories
        await mkdirAsync(path.dirname(newPath), {recursive: true});

        try {
            // 2. rename the file (move it to the new directory)
            await renameAsync(oldPath, newPath);
        }
        catch(error) {
            // The 'rename' function does not work across different mount points, 
            // you will get error code 'EXDEV' (creoss-device link not permitted)
            // for example when using Docker volumes you will hit this error.
            // EXDEV oldpath and newpath are not on the same mounted filesystem. 
            // (Linux permits a filesystem to be mounted at multiple points,
            // but rename() does not work across different mount points,
            // even if the same filesystem is mounted on both.)
            if(error.code === 'EXDEV') {
                // 3. Copy the file as a fallback
                await copyFileAsync(oldPath, newPath);

                // 4. remove the old file
                await unlinkAsync(oldPath);
            }
            else {
                // Throw any other errors
                throw error;
            }
        }
    }

    async move(fileName) {
        let oldPath = path.join(this.tempDirPath, fileName);
        let newPath = path.join(this.sourceDirPath, fileName);

        await this.moveFile(oldPath, newPath);
    }
}

module.exports = FileManager;