mysql = require("mysql")
fs = require("fs")
util = require("util")
_ = require("lodash")

config = require("./config.json")

const OUTPUT_FILE = "result.json"

const connection = mysql.createConnection({
    host: config.sql_host, 
    user: config.sql_user,
    database: config.sql_database
})

query = fs.readFileSync("./query.sql").toString()

connection.connect(async (err) => {
    if (err) throw err
    console.log("Connected to database")

    await dumpToFile(query)
    connection.destroy()
})


/**
 * Execute the specified SELECT query, write the data to a file, 
 * and remove the entries from the database
 * @param {string} selectQuery the SELECT query to execute 
 */
async function dumpToFile(selectQuery) {
    return new Promise((resolve, reject) => {
        if (!selectQuery) reject(new Error("Must supply selectQuery"))

        connection.query(query, async (err, result) => {
            if (err) reject(err)
    
            await writeToFile(result, OUTPUT_FILE)
            if (verifyIntegrity(result, OUTPUT_FILE)) {
                await removeFromDatabase(result)
                console.log("Done!")
            } else {
                reject(new Error("Data integrity was lost"))
            }

            resolve()
        })
    })
}


/**
 * Write the data from the sql query result to the specified file
 * @param {*} data 
 * @param {string} filePath 
 */
function writeToFile(data, filePath) {
    if (!data) throw new Error("Must supply data")

    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, JSON.stringify(data), (err) => {
            if (err) reject(err)
            console.log("result saved to " + filePath)
            resolve()
        })
    })
}

/**
 * Compares the data from the sql query result with the data written to the file
 * @param {string} result 
 * @param {*} filePath 
 */
function verifyIntegrity(result, filePath) {
    string = fs.readFileSync(filePath).toString()
    jsonObjFromFile = JSON.parse(string)
    
    jsonResult = JSON.parse(JSON.stringify(result))

    // Compare the two arrays using lodash
    return _.isEqual(_.sortBy(jsonResult), _.sortBy(jsonObjFromFile))
}

/**
 * Delete the entries fetched from the database
 * @param {*} result an array with the results from the select query
 */
function removeFromDatabase(result) {

    return new Promise((resolve, reject) => {
        let count = 0;

        if (result.length == 0) resolve()

        for (let i = 0; i < result.length; i++) {
            const row = result[i];
    
            lastID = row.id
            connection.query("DELETE FROM users WHERE id = ?;", row.id, async (err, result) => {
                if (err) reject(err)
                queryDone()
            })
        }

        /**
         * Callback to make sure that all delete queries finishes
         */
        function queryDone(){
            count++
            if (count == result.length) {
                resolve()
            }
        }

    })

}