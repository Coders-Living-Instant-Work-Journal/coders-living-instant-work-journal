const base64 = require('base-64');
const bcrypt = require('bcrypt');
const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('file-system')
const { gap, greeting, signUpPrompts, signInPrompts, crudPrompts, entryFilter, datePrompt, entryList, updateDelete, updatePrompt, categoryPrompt, createPrompt, categoryDatePrompt } = require('./prompts');
const superagent = require('superagent');
let jwt;


const api_server_uri = 'http://localhost:3000';

const themeColor = 'green';


// GREET NEW AND EXISING USERS

function greetingMenu() {
  headerHandler();
  inquirer.prompt(greeting)
    .then(answer => {
      switch (answer.signup_or_in) {
        case 'SIGN UP': signUp(); break;
        case 'SIGN IN': signIn(); break;
        case 'EXIT': exitHandler(); break;
        default: null;
      }
    });
}

// SIGNS USER OUT BY DELETING JWT FILE

function signOut(message) {
  fs.unlink('jwt.txt', function (err) {
    if (err) throw err;
    if (message) console.log('Invalid Token.')
    exitHandler('You have signed out.')
  })
}

// START MENU FOR REGISTERED USERS

function startMenu() {
  headerHandler();
  console.log(chalk.keyword(themeColor)('------- START MENU -------\n'));
  inquirer.prompt(crudPrompts)
    .then(answer => {
      switch (answer.crud) {
        case 'CREATE ENTRY': createEntry(); break;
        case 'LIST ENTRIES': selectFilter(); break;
        case 'SIGN OUT': signOut(); break;
        case 'EXIT': exitHandler(); break;
        default: startMenu(); break;
      }
    })
}

// CRUD FUNCTIONS


// CREATE

function createEntry() {
  headerHandler();
  console.log(chalk.keyword(themeColor)('------ CREATE ENTRY ------\n'));
  inquirer.prompt(createPrompt)
    .then(answer => postAPI({ category: answer.create_category_prompt, text: answer.create_text_prompt }))
}

// READ

function selectFilter() {
  headerHandler();
  console.log(chalk.keyword(themeColor)('------ SELECT FILTER -----\n'));
  inquirer.prompt(entryFilter)
    .then(answer => {
      switch (answer.entry_filters) {
        case 'DISPLAY ALL': getEntries(); break;
        case 'CATEGORY': selectCategory(); break;
        case 'DATE': filterDate(); break;
        case 'CATEGORY AND DATE': filterCategoryDate(); break;
        // case 'JOURNAL': getJournals(); break;
        case 'EXIT': exitHandler(); break;
        default: break;
      }
    })
}

function filterCategoryDate() {
  headerHandler();
  console.log(chalk.keyword(themeColor)('-- PICK CATEGORY & DATE --\n'));
  inquirer.prompt(categoryDatePrompt)
    .then(answer => {
      const dateRange = dateHandler(answer)
      dateRange.category = answer.category_prompt;
      getEntries(dateRange)
    })
}

function selectCategory() {
  headerHandler();
  console.log(chalk.keyword(themeColor)('---- ENTER A CATEGORY ----\n'));
  // get request of categories by filtering json on category property within each journal
  inquirer.prompt(categoryPrompt)
    .then(answer => {
      getEntries({ category: answer.category_prompt })
    })
  // STRETCH: does text turn green after inputed category typed is a match?
  // STRETCH: list all categories if requested
}

function filterDate() {
  headerHandler();
  console.log(chalk.keyword(themeColor)('------ SELECT DAYS -------\n'));
  inquirer.prompt(datePrompt)
    .then(answer => {
      const dateRange = dateHandler(answer);
      getEntries(dateRange)
    })
}

function getJournals() {
  // get request of journals by filtering json on journal property within each user

  getEntries(filter);
}

// READ continued - queries api for entries based on filter

function getEntries(filter) {
  superagent
    .get(`${api_server_uri}/read`)
    .set('Authorization', jwt)
    .send(filter)
    .then(res => {
      if (res.body.length === 0) {
        exitHandler('There are no entries.')
      } else {
        entryPromptConstructor(res.body)
      }
    })
    .catch(err => console.error(err.response.body.error))
}



function entryPromptConstructor(entries) {
  entryList[0].choices = [];
  entries.forEach(entry => {
    entryList[0].choices.push(`${entry.date} ${entry.category} ${entry._id}`)
    entryList[0].choices.push(gap);
  })
  entryList[0].choices.push('EXIT', gap);
  listEntries(entries);
}

function listEntries(entries) {
  headerHandler();
  console.log(chalk.keyword(themeColor)('------ SELECT ENTRY ------\n'));
  inquirer.prompt(entryList)
    .then(answer => {
      const entry = entries.filter(obj => obj._id === answer.entry_list.split(' ')[2])
      displayEntry(entry);
    })
}

function displayEntry(entry) {
  headerHandler();
  console.log(chalk.keyword(themeColor)('--------- ENTRY ----------\n'));
  console.log(`id:       ${entry[0]._id}`)
  console.log(`date:     ${entry[0].date}`)
  console.log(`category: ${entry[0].category}`)
  console.log(`entry: \n${entry[0].text}\n`)
  inquirer.prompt(updateDelete)
    .then(answer => {
      switch (answer.update_delete) {
        case 'UPDATE ENTRY': updateEntry(entry[0]); break;
        case 'DELETE ENTRY': deleteEntry({ id: entry[0]._id }); break;
        case 'START MENU': startMenu(); break;
        case 'EXIT': exitHandler(); break;
        default: break;
      }
    })
}

// UPDATE

function updateEntry(entry) {
  updatePrompt[0].default = entry.category;
  updatePrompt[1].default = entry.text;
  inquirer.prompt(updatePrompt)
    .then(answer => {
      if (answer.update_category !== entry.category && answer.update_entry !== entry.text) {
        putAPI({ category: answer.update_category, id: entry._id, text: answer.update_entry })
      } else if (answer.update_category !== entry.category) {
        putAPI({ category: answer.update_category, id: entry._id })
      } else if (answer.update_entry !== entry.text) {
        putAPI({ text: answer.update_entry, id: entry._id })
      } else {
        exitHandler('No changes have been made'); 
      }
    })
}

// DELETE

function deleteEntry(id) {
  superagent
    .delete(`${api_server_uri}/delete`)
    .set('Authorization', jwt)
    .send(id)
    .then(res => exitHandler(res.text))
    .catch(err => console.error(err.response.body.error))
}

// POST TO API

function postAPI(entry) {
  superagent
    .post(`${api_server_uri}/create`)
    .set('Authorization', jwt)
    .send(entry)
    .then(res => exitHandler(`Entry successfully created with id:${res.body.entry._id}`))
    .catch(err => console.error(err.response.body.error))
}

// PUT TO API

function putAPI(entry) {
  superagent
    .put(`${api_server_uri}/update`)
    .set('Authorization', jwt)
    .send(entry)
    .then(res => exitHandler(res.text))
    .catch(err => console.error(err.response.body.error))
}

// SIGN UP

function signUp() {
  headerHandler();
  console.log(chalk.keyword(themeColor)('-------- SIGN UP ---------\n'));
  inquirer.prompt(signUpPrompts)
    .then(async answer => {
      answer.new_user_password = await bcrypt.hash(answer.new_user_password, 5);
      return answer;
    })
    .then(answer => {
      signUpApi({ email: answer.new_user_email, password: answer.new_user_password, name: answer.new_user_name })        
    });
}

function signUpApi(user) {
  superagent
    .post(`${api_server_uri}/signup`)
    .send(user)
    .then(res => {
      storeToken(res.body.token, 'signed up')
    })
    .catch(err => console.error('User already exist.'))
}
// STORES TOKEN IN JWT.TXT
function storeToken(token, logState) {
  fs.writeFile('./jwt.txt', token, function (err) {
    if (err) throw err;
    exitHandler(`You have successfully ${logState}.\nType in clij to start your journey.\nJWT token Saved!`)
  })
}

// SIGN IN

function signIn() {
  headerHandler();
  console.log(chalk.keyword(themeColor)('-------- SIGN IN ---------\n'));
  inquirer.prompt(signInPrompts)
    .then(answer => {
      superagent
        .post(`${api_server_uri}/signin`)
        .set('Authorization', base64.encode(`${answer.user_email}:${answer.user_password}`))
        .then(res => {
          storeToken(res.body.token, 'signed in')
        })
        .catch(err => console.error(err.response.body.error))
    });
}


// CHECKS IF USER HAS JWT TOKEN

if (fs.existsSync('jwt.txt')) {
  // Retrieves JWT token from jwt.txt
  fs.readFile('jwt.txt', function(err,data) {
      if(err) throw err;
      jwt = data.toString();
  })
  startMenu();
} else {
  greetingMenu();
}


// MISCELLANEOUS HANDLERS

function dateHandler(answer) {
  let endDate = new Date();
  let startDate = new Date(endDate.setDate(endDate.getDate() - answer.day_selector));
  endDate = new Date();
  return { startDate: startDate, endDate: endDate };
}

function headerHandler() {
  console.clear();
  clijBannerHandler();
}

function clijBannerHandler() {
  console.log(chalk.keyword(themeColor)('\n ___   _      _   _______'));
  console.log(chalk.keyword(themeColor)('/ __| | |    |_| |___   _|'));
  console.log(chalk.keyword(themeColor)('| |   | |     _   _  | |'));
  console.log(chalk.keyword(themeColor)('| |_  | |__  | | | |_| |'));
  console.log(chalk.keyword(themeColor)('\\___| |____| |_| \\_____/\n'));
}

function exitHandler(message) {
  console.clear();
  if (message) console.log(message);
  process.exit();
}

module.exports = { greetingMenu, signUp };