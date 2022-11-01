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

/**
 * Access a variable inside of process.env, throwing an error if it's not found.
 * Always run this method in advance (i.e. upon initialisation) so that the error is
 * thrown as early as possible.
 * Catching the values improves performance - accessing process.env many times is bad
 */

const cache = {};

const accessEnv = (key, defaultValue) => {
    if(!(key in process.env)) {
        if(defaultValue) return defaultValue;
        throw new Error(`${key} not found in process.env!`);
    }

    if(cache[key]) return cache[key];

    cache[key] = process.env[key];

    return process.env[key];
};

module.exports = accessEnv;
