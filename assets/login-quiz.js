
const WORKER_PATH = '/assets/factorization/elliptic-curve/worker.js';

const factor = async (n) => {
  const bigN = BigInt(n);
  return await new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_PATH);
    worker.onmessage = (ev) => {
      if (ev.data === true) {
        worker.postMessage(bigN);
        return;
      }
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

/**
 * @type {HTMLButtonElement}
 */
const submitButton = document.querySelector('form button[type="submit"]');
const loginForm = document.querySelector('#login-form');
const loginFormStatus = document.querySelector('#login-form-status');
const inputQuiz = document.querySelector('#login-form-quiz-factorization');
const inputQuizAnswer = document.querySelector('#login-form-quiz-factorization-answer');
if (!inputQuiz || !inputQuizAnswer) {
  loginForm.hidden = false;
  submitButton.disabled = false;
} else {
  const n = inputQuiz.value;
  factor(n).then((factors) => {
    inputQuizAnswer.value = factors.join(',');
    loginForm.hidden = false;
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
