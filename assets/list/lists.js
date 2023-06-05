
async function createList(listName, members) {
  const response = await fetch('/create-list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      listName,
      users: members,
    }),
  });
  const data = await response.json();
  if (data.error) {
    console.error('Error response:', data);
    document.getElementById('error').textContent = data.error;
  } else {
    renderLists(data.lists);
  }
}

const listsElement = document.getElementById('lists');
function renderLists(lists) {
  listsElement.textContent = '';
  for (const list of lists) {
    const listElement = document.createElement('li');
    const linkElement = document.createElement('a');
    linkElement.textContent = list;
    linkElement.href = '/mailing-list?list=' + encodeURIComponent(list);
    listElement.appendChild(linkElement);
    listsElement.appendChild(listElement);
  }
}

const createListButton = document.getElementById('create_list_button');
const createListName = document.getElementById('create_list_name');
const createListMembers = document.getElementById('create_list_members');
createListButton.onclick = async () => {
  const listName = createListName.value.trim();
  const members = createListMembers.value.trim();
  if (listName == '' || members == '') return;
  createListName.value = '';
  createListMembers.value = '';
  try {
    await createList(listName, members);
  } catch (e) {
    console.error(e);
  }
};

fetch('/get-lists')
.then(response => response.json())
.then(data => {
  if (data.error) {
    console.error('Error response:', data);
    document.getElementById('error').textContent = data.error;
  } else {
    renderLists(data.lists);
  }
})
.catch((e) => {
  console.error(e);
});
