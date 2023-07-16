const router = require('express').Router();
const mondayRoutes = require('./monday');
const fetch = require('node-fetch');

router.use(mondayRoutes);

router.get('/', function (req, res) {
  res.json(getHealth());
});

router.get('/health', function (req, res) {
  res.json(getHealth());
  res.end();
});
router.post('/hitserver', function (req, res) {
  const { payload } = req.body;
  const { inputFields } = payload;

  // try {
      //get column data
      //  const query = `query {boards (ids: ${inputFields.boardId}) { columns { id title }}}`;
      //  fetch ("https://api.monday.com/v2", {
      //    method: 'post',
      //    headers: {
      //      'Content-Type': 'application/json',
      //      'Authorization' : token,
      //    },
      //    body: JSON.stringify({
      //      'query' : query
      //    })
      //    })
      //    .then(res => res.json())
      //    .then(res => console.log(res.data.boards[0].columns));
  // } catch (error) {
  //   console.log('error', error)
  // }
  getHealthData(inputFields)
  res.sendStatus(200);
});

async function getHealthData(inputFields) {
  //fetch patient data
  try {
    const res = await fetch('https://fhirsandbox.healthit.gov/open/r4/fhir/Patient/123d41e1-0f71-4e9f-8eb2-d1b1330201a6?_format=json')
    const data = await res.json();
    
  //get patient observation
    const res2 = await fetch('https://fhirsandbox.healthit.gov/open/r4/fhir/Observation?patient=123d41e1-0f71-4e9f-8eb2-d1b1330201a6')
    const data2 = await res2.json();

    // filter only hemoglobin results
    const hemoglobinObservations = data2.entry.filter(entry => {
      const code = entry.resource.code.coding[0].code;
      return code === '718-7' || code === '4548-4'; // Hemoglobin [g/Dl] in Blood || Hemoglobin A1c/Hemoglobin.total in Blood (%)
    });
    
    const hemoglobinLevelsByDate = hemoglobinObservations.map(entry => {
      const Date = entry.resource.effectiveDateTime.split('T')[0];
      const Value = entry.resource.valueQuantity.value + `${entry.resource.valueQuantity.unit}`;;
      return { Date, Value };
    });

    const fullName = `${data.name[0].prefix[0] || ''} ${data.name[0].given[0]} ${data.name[0].family}`;
    const age = calculateAge(data.birthDate);
    const gender = data.gender;
  
    const mappedData = {
      id: data.id,
      name: fullName,
      age: age,
      gender: gender,
      hemoglobinLevelsByDate: JSON.stringify(hemoglobinLevelsByDate).replaceAll("\"", ""),
    };
  
    updateTable(inputFields, mappedData);
  } catch (error) {
    console.log('error in get patient', error)
  }
}

function updateTable(inputFields, mappedData) {
  // Build the mutation query to create new row of a patient
  let query = `mutation {
    create_item (
      board_id: ${inputFields.boardId},
      group_id: \"topics"\,
      item_name: \"${mappedData.name}"\,
      column_values: \"{
        \\\"text_1\\\": \\\"${mappedData.id}\\\", 
        \\\"name\\\": \\\"${mappedData.name}\\\", 
        \\\"age\\\": ${mappedData.age}, 
        \\\"hemoglobin_levels2\\\": \\\"${mappedData.hemoglobinLevelsByDate}\\\",
        \\\"text2\\\": \\\"${mappedData.gender}\\\"}\"
    ) {
      id
    }
  }`;
  
  mondayApi(query);
  
}

function calculateAge(birthDate) {
  const today = new Date();
  const dob = new Date(birthDate);
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age;
}

async function mondayApi(query) {
  try {
    fetch ("https://api.monday.com/v2", {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization' : process.env.API_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        'query' : query
      })
      })
      .then(res => res.json())
      .then(res => console.log(res))
  } catch (error) {
    console.log('error', error)
  }
}

// async function getAccessToken() {
//   try {
//     const res = await fetch("https://auth.monday.com/oauth2/authorize?client_id=98f08f1dddd9f82a5c829957ccba1405");
//     console.log('res', res)
//     const token = res.url.split('oauth_payload_token=')[1];
//     console.log('token', token)
//     return token;
//   } catch (error) {
//     console.log('error in get token', error);
//   }
// } 

async function getHealth() {
  return {
    ok: true,
    message: 'Healthy',
  };
}

module.exports = router;
