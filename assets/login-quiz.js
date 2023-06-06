
const WORKER_PATH = '/assets/factorization/quadratic-sieve.js';

const factor = async (n) => {
  const bigN = BigInt(n);
  return await new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_PATH);
    worker.onmessage = (ev) => {
      resolve(ev.data);
    };
    worker.onerror = (ev) => {
      reject(ev);
    };
    worker.postMessage(bigN);
  });
};

const loginForm = document.querySelector('#login-form');
const loginFormStatus = document.querySelector('#login-form-status');
const inputQuiz = document.querySelector('#login-form-quiz-factorization');
const inputQuizAnswer = document.querySelector('#login-form-quiz-factorization-answer');
if (!inputQuiz || !inputQuizAnswer) {
  loginForm.hidden = false;
} else {
  const n = inputQuiz.value;
  factor(n).then((factors) => {
    inputQuizAnswer.value = factors.join(',');
    loginForm.hidden = false;
    loginFormStatus.textContent = 'You can log in now.';
  }).catch((e) => {
    console.error(e);
    loginFormStatus.textContent = 'Failed to factorize the number. Please contact the administrator.';
  });
}
