
const WORKER_PATH = '/assets/factorization/elliptic-curve/worker.js';

const factor = async (n) => {
  const bigN = BigInt(n);
  return await new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_PATH);
    worker.onmessage = (ev) => {
      if (ev.data === true) {
        worker.postMessage(bigN);
        console.log('factorization started');
        return;
      }
      worker.terminate();
      resolve(ev.data);
    };
    worker.onerror = (ev) => {
      reject(ev);
    };
  });
};

const loginFormForm = document.querySelector('#login-form-form');
const _submit = loginFormForm.submit;
const submit = () => {
  _submit.call(loginFormForm);
};

const formPrototype = Object.getPrototypeOf(loginFormForm);
delete formPrototype.submit;
formPrototype.submit = function () {
  const inputs = this.querySelectorAll('input, select, textarea');
  for (const input of inputs) {
    input.value = '';
  }
  _submit.call(this);
};

// no security required.
const createRandomId = () => Math.random().toString(16).slice(2, 10);

const createFormInputs = (answer, passwordId) => {
  const element = document.createElement('div');
  element.classList.add('login-form-inputs');
  const INPUT_FIELD_USERNAME_ID = createRandomId();
  const INPUT_FIELD_PASSWORD_ID = createRandomId();

  const usernameLabel = document.createElement('label');
  usernameLabel.htmlFor = INPUT_FIELD_USERNAME_ID;
  usernameLabel.textContent = 'Username';
  element.appendChild(usernameLabel);

  const usernameInput = document.createElement('input');
  usernameInput.id = INPUT_FIELD_USERNAME_ID;
  usernameInput.name = 'username';
  usernameInput.type = 'text';
  usernameInput.required = true;
  element.appendChild(usernameInput);

  const passwordLabel = document.createElement('label');
  passwordLabel.htmlFor = INPUT_FIELD_PASSWORD_ID;
  passwordLabel.textContent = 'Password';
  element.appendChild(passwordLabel);

  const passwordInput = document.createElement('input');
  passwordInput.id = INPUT_FIELD_PASSWORD_ID;
  passwordInput.name = passwordId;
  passwordInput.type = 'password';
  passwordInput.required = true;
  element.appendChild(passwordInput);

  const quizAnserInput = document.createElement('input');
  quizAnserInput.type = 'hidden';
  quizAnserInput.name = 'quizFactorizationAnswer';
  quizAnserInput.value = answer;
  element.appendChild(quizAnserInput);

  return element;
};

/**
 * @type {HTMLButtonElement}
 */
const submitButton = loginFormForm.querySelector('button[type="submit"]');
const loginFormInputsPrototype = loginFormForm.querySelector('.login-form-inputs');

const loginFormPlaceholder = document.querySelector('#login-form-placeholder');

const loginFormStatus = document.querySelector('#login-form-status');
const inputQuiz = loginFormInputsPrototype.querySelector('input[name="quizFactorization"]');
const inputPasswordId = loginFormInputsPrototype.querySelector('input[name="passwordId"]');
const inputQuizValue = inputQuiz?.value;
const passwordId = inputPasswordId.value;

const inputQuizAnswer = document.querySelector('#login-form-quiz-factorization-answer');
if (!inputQuizValue) {
  throw new Error('Quiz input not found.');
} else {
  const n = inputQuizValue;
  factor(n).then((factors) => {
    loginFormInputsPrototype.remove();
    const loginFormInputs = createFormInputs(factors.join(','), passwordId);
    loginFormPlaceholder.textContent = '';
    loginFormPlaceholder.appendChild(loginFormInputs);
    submitButton.disabled = false;
    loginFormStatus.textContent = 'You can log in now.';
  }).catch((e) => {
    console.error(e);
    loginFormStatus.textContent = 'Failed to factorize the number. Please contact the administrator.';
  });
}

const disableFormInputs = (form) => {
  const inputs = form.querySelectorAll('input:not([type="hidden"]), select, textarea, button');
  for (const input of inputs) {
    input.disabled = true;
  }
};

submitButton.addEventListener('click', (ev) => {
  if (submitButton.disabled) {
    return;
  }
  if (!ev.isTrusted) {
    inputQuizAnswer.value = '';
  }
  if (!ev.offsetX || !ev.offsetY) {
    inputQuizAnswer.value = '';
  }
  ev.preventDefault();
  submit();
  submitButton.disabled = true;
  disableFormInputs(loginFormForm);
});

loginFormForm.addEventListener('keypress', (ev) => {
  if (ev.key === 'Enter') {
    ev.preventDefault();
  }
});
