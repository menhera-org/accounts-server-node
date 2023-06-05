
fetch('/get-username')
.then(response => response.json())
.then(data => {
  if (!data.logged_in) return;
  document.getElementById('username').textContent = data.username;
  if (data.is_admin) {
    document.body.classList.add('admin');
    document.getElementById('username').textContent += ' (admin)';
  }
})
.catch((e) => {
  console.error(e);
});
