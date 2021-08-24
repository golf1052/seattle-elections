let map = L.map('map').setView([47.620540, -122.349246], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// colors
// teal: #1B9E77
// orange: #D95F02
// purple: #7570B3
// magenta: #E7298A
// green: #66A61E
// yellow: #E6AB02

const colors = [
    '#1B9E77',
    '#D95F02',
    '#7570B3',
    '#E7298A',
    '#66A61E',
    '#E6AB02'
];

let selectedYear = '';
let selectedElection = '';
let selectedResults = null;
let selectedRace = '';
let geoJsonLayer = null;

document.getElementById('yearDropdown').addEventListener('change', function(e) {
    if (e.target.value === '') {
        return;
    }
    selectedYear = e.target.value;
    
    // clear other dropdowns
    const electionDropdown = document.getElementById('electionDropdown');
    electionDropdown.innerHTML = '';
    const raceDropdown = document.getElementById('raceDropdown');
    raceDropdown.innerHTML = '';

    electionDropdown.appendChild(createEmptyOptionElement('Select an election'));
    const primaryOption = document.createElement('option');
    primaryOption.value = 'primary';
    primaryOption.text = 'Primary';
    electionDropdown.appendChild(primaryOption);

    if (selectedYear === '2017' ||
        selectedYear === '2021') {
        const estimatedOption = document.createElement('option');
        estimatedOption.value = 'estimated';
        estimatedOption.text = 'Estimated';
        electionDropdown.appendChild(estimatedOption);
    }

    if (selectedYear === '2017') {
        const errorOption = document.createElement('option');
        errorOption.value = 'error';
        errorOption.text = 'Error';
        electionDropdown.appendChild(errorOption);
    }

    if (selectedYear === '2017' ||
        selectedYear === '2018' ||
        selectedYear === '2019' ||
        selectedYear === '2020') {
        const generalOption = document.createElement('option');
        generalOption.value = 'general';
        generalOption.text = 'General';
        electionDropdown.appendChild(generalOption);
    }
});

document.getElementById('electionDropdown').addEventListener('change', function(e) {
    if (e.target.value === '') {
        return;
    }

    selectedElection = e.target.value;

    if (selectedYear === '2017') {
        if (selectedElection === 'primary') {
            selectedResults = results2017Primary;
        } else if (selectedElection === 'estimated') {
            selectedResults = results2017Estimated;
        } else if (selectedElection === 'error') {
            selectedResults = results2017Error;
        } else if (selectedElection === 'general') {
            selectedResults = results2017General;
        }
    } else if (selectedYear === '2018') {
        if (selectedElection === 'primary') {
            selectedResults = results2018Primary;
        } else if (selectedElection === 'general') {
            selectedResults = results2018General;
        }
    } else if (selectedYear === '2019') {
        if (selectedElection === 'primary') {
            selectedResults = results2019Primary;
        } else if (selectedElection === 'general') {
            selectedResults = results2019General;
        }
    } else if (selectedYear === '2020') {
        if (selectedElection === 'primary') {
            selectedResults = results2020Primary;
        } else if (selectedElection === 'general') {
            selectedResults = results2020General;
        }
    } else if (selectedYear === '2021') {
        if (selectedElection === 'primary') {
            selectedResults = results2021Primary;
        } else if (selectedElection === 'estimated') {
            selectedResults = results2021Estimated;
        }
    }

    populateRaceDropdown();
});

document.getElementById('raceDropdown').addEventListener('change', function(e) {
    if (e.target.value === '') {
        return;
    }

    selectedRace = e.target.value;
    usedColors = {};
    if (geoJsonLayer != null) {
        geoJsonLayer.removeFrom(map);
    }

    if (selectedElection !== 'error') {
        calculateRegisteredVoterPercentages();
        calculateVotedVoterPercentages();
    }
    geoJsonLayer = getGeoJson();
    geoJsonLayer.addTo(map);
});

function getGeoJson() {
    return L.geoJSON(features, {
        onEachFeature: function (feature, layer) {
            if (selectedElection === 'error') {
                createErrorPopup(feature, layer);
            } else {
                createPopup(feature, layer);
            }  
        },
        style: function(feature) {
            if (selectedElection === 'error') {
                return createErrorStyle(feature);
            } else {
                return createStyle(feature);
            }
        }
    });
}

function createPopup(feature, layer) {
    const neighborhoodName = feature.properties.neighborhood;
    let results = getNeighborhoodResultsFromName(neighborhoodName);
    let foundRace = results.races.find(e => { return e.name === selectedRace; });
    if (foundRace === undefined) {
        return;
    }
    const voterTurnout = ((foundRace.total_votes / foundRace.registered_voters) * 100).toFixed(2);
    let html = '';
    html += `<p>Voter turnout: ${voterTurnout}%<p>`
    html += `<p>Percentage of registered voters: ${foundRace.percentageOfRegisteredVoters}%</p>`;
    html += `<p>Percentage of votes: ${foundRace.percentageOfVotes}%</p>`;
    html += '<hr>'
    foundRace.votes.sort((a, b) => {
        return a.votes < b.votes;
    });
    for (let i = 0; i < foundRace.votes.length; i++) {
        let item = foundRace.votes[i];
        html += `<p>${item.item}: ${item.votes} (${((item.votes / foundRace.total_votes) * 100).toFixed(2)}%)</p>`;
    }
    let popup = L.popup()
        .setContent(`<div><p>${feature.properties.neighborhood}</p><hr>${html}</div>`);
    layer.bindPopup(popup);
}

function createStyle(feature) {
    const neighborhoodName = feature.properties.neighborhood;
    const results = getNeighborhoodResultsFromName(neighborhoodName);
    const foundRace = results.races.find(e => { return e.name === selectedRace; });
    if (foundRace === undefined) {
        return;
    }
    const total = foundRace.total_votes;
    let topCandidate = null;
    for (let i = 0; i < foundRace.votes.length; i++) {
        const item = foundRace.votes[i];
        if (item.item == 'Write-in') {
            continue;
        }
        if (topCandidate === null || item.votes > topCandidate.votes) {
            topCandidate = {
                name: item.item,
                votes: item.votes
            };
        }
    }
    return {
        fillColor: getUnusedColor(topCandidate.name),
        fillOpacity: topCandidate.votes / total,
        weight: 2,
        dashArray: 5,
        color: '#000'
    };
}

function createErrorPopup(feature, layer) {
    const neighborhoodName = feature.properties.neighborhood;
    let results = getNeighborhoodResultsFromName(neighborhoodName);
    let foundRace = results.races.find(e => { return e.name === selectedRace; });
    if (foundRace === undefined) {
        return;
    }

    let html = '';
    html += `<p>Registered voters error: ${(foundRace.registered_voters * 100).toFixed(2)}%</p>`;
    html += `<p>Votes error: ${(foundRace.total_votes * 100).toFixed(2)}%</p>`;
    html += '<hr>'

    foundRace.votes.sort((a, b) => {
        return a.votes < b.votes;
    });
    for (let i = 0; i < foundRace.votes.length; i++) {
        let item = foundRace.votes[i];
        html += `<p>${item.item} error: ${(item.votes * 100).toFixed(2)}%</p>`;
    }
    let popup = L.popup()
        .setContent(`<div><p>${feature.properties.neighborhood}</p><hr>${html}</div>`);
    layer.bindPopup(popup);
}

function createErrorStyle(feature) {
    const neighborhoodName = feature.properties.neighborhood;
    const results = getNeighborhoodResultsFromName(neighborhoodName);
    const foundRace = results.races.find(e => { return e.name === selectedRace; });
    if (foundRace === undefined) {
        return;
    }
    const total = foundRace.total_votes;
    let topCandidate = null;
    for (let i = 0; i < foundRace.votes.length; i++) {
        const item = foundRace.votes[i];
        if (item.item == 'Write-in') {
            continue;
        }
        if (topCandidate === null || Math.abs(item.votes) > Math.abs(topCandidate.votes)) {
            topCandidate = {
                name: item.item,
                votes: item.votes
            };
        }
    }
    return {
        fillColor: 'red',
        fillOpacity: Math.abs(topCandidate.votes),
        weight: 2,
        dashArray: 5,
        color: '#000'
    };
}

function getNeighborhoodResultsFromName(name) {
    return selectedResults.find(e => {
        return e.neighborhood == name;
    });
}

function calculateRegisteredVoterPercentages() {
    let registeredVoters = 0;
    selectedResults.forEach(function(result) {
        let foundRace = result.races.find(e => { return e.name === selectedRace; });
        if (foundRace === undefined) {
            return;
        }
        registeredVoters += foundRace.registered_voters;
    });
    
    selectedResults.forEach(function(result) {
        let foundRace = result.races.find(e => { return e.name === selectedRace; });
        if (foundRace === undefined) {
            return;
        }
        const percentageOfRegisteredVoters = ((foundRace.registered_voters / registeredVoters) * 100).toFixed(2);
        foundRace.percentageOfRegisteredVoters = percentageOfRegisteredVoters;
    });
}

function calculateVotedVoterPercentages() {
    let totalVotes = 0;
    selectedResults.forEach(function(result) {
        let foundRace = result.races.find(e => { return e.name === selectedRace; });
        if (foundRace === undefined) {
            return;
        }
        totalVotes += foundRace.total_votes;
    });

    selectedResults.forEach(function(result) {
        let foundRace = result.races.find(e => { return e.name === selectedRace; });
        if (foundRace === undefined) {
            return;
        }
        const percentageOfVotes = ((foundRace.total_votes / totalVotes) * 100).toFixed(2);
        foundRace.percentageOfVotes = percentageOfVotes;
    });
}

function populateRaceDropdown() {
    if (selectedResults === null) {
        return;
    }

    const raceDropdown = document.getElementById('raceDropdown');
    raceDropdown.innerHTML = '';

    const raceSet = new Set();
    selectedResults.forEach(function(result) {
        result.races.forEach(function(race) {
            raceSet.add(race.name);
        });
    });

    const raceList = Array.from(raceSet);
    raceList.sort();

    raceDropdown.appendChild(createEmptyOptionElement('Select a race'));
    raceList.forEach(function(race) {
        const option = document.createElement('option');
        option.value = race;
        option.text = race;
        raceDropdown.appendChild(option);
    });
}

function getUnusedColor(candidateName) {
    if (usedColors[candidateName]) {
        return usedColors[candidateName];
    } else {
        let color = colors[Object.keys(usedColors).length];
        usedColors[candidateName] = color;
        return color;
    }
}

function createEmptyOptionElement(text) {
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.text = text;
    return emptyOption;
}
