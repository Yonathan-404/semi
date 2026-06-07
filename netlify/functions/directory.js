// netlify/functions/directory.js
// Public: just the list of district + branch names/ids for login dropdowns.
// No data, no targets, no auth — only labels needed to pick who you are.
const { Store } = require('../../lib/store');
function json(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) };
}
exports.handler = async function () {
  const districts = await Store.listDistricts();
  const branches = await Store.listBranches();
  return json(200, {
    districts: districts.map((d) => ({ id: d.id, name: d.name })).sort((a, b) => a.name.localeCompare(b.name)),
    branches: branches.map((b) => ({ id: b.id, name: b.name, districtId: b.districtId })).sort((a, b) => a.name.localeCompare(b.name))
  });
};
