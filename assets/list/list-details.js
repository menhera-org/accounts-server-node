
async function addListMember(listName, user) {
  const response = await fetch('/list-add-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      listName,
      addUsername: user,
    }),
  });
  const data = await response.json();
  if (data.error) {
    console.error('Error response:', data);
    document.getElementById('error').textContent = data.error;
  } else {
    renderList(data.listName, data.users);
  }
}

async function removeListMember(listName, user) {
  const response = await fetch('/list-remove-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      listName,
      removeUsername: user,
    }),
  });
  const data = await response.json();
  if (data.error) {
    console.error('Error response:', data);
    document.getElementById('error').textContent = data.error;
  } else if (data.listRemoved) {
    window.location.href = '/mailing-lists';
  } else {
    renderList(data.listName, data.users);
  }
}

const membersElement = document.getElementById('members');
function renderList(listName, members) {
  const title = `Mailing list: ${listName}`;
  document.title = title;
  document.getElementById('heading').textContent = title;
  membersElement.textContent = '';
  for (const member of members) {
    const memberElement = document.createElement('li');
    memberElement.textContent = member + ' ';
    const removeButton = document.createElement('button');
    removeButton.classList.add('list-user-remove-button');
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => {
      removeListMember(listName, member).catch((e) => {
        const message = String(e.message || e);
        document.getElementById('error').textContent = message;
        console.error(e);
      });
    });
    memberElement.appendChild(removeButton);
    membersElement.appendChild(memberElement);
  }
}

const params = new URLSearchParams(window.location.search);
const listName = params.get('list');

const addMemberName = document.getElementById('add_member_name');
const addMemberButton = document.getElementById('add_member_button');
addMemberButton.addEventListener('click', () => {
  const addUsername = addMemberName.value;
  addMemberName.value = '';
  addListMember(listName, addUsername).catch((e) => {
    const message = String(e.message || e);
    document.getElementById('error').textContent = message;
    console.error(e);
  });
});

fetch('/get-list-members?listName=' + encodeURIComponent(listName))
.then(response => response.json())
.then(data => {
  if (data.error) {
    console.error('Error response:', data);
    document.getElementById('error').textContent = data.error;
  } else {
    renderList(data.listName, data.users);
  }
})
.catch((e) => {
  console.error(e);
});
