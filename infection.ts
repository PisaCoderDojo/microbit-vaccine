/**
 * 
 * Infection game
 * 
 * Flash all micro:bit will this script
 * 
 * Press A+B to enter master mode (1 per game)
 * 
 * Choose the percentage of vaccinated players: a zero will will display on screen. Press B to increase the selected percentage and A to decrease it.
 * The new selection will display on screen: press A+B to confirm your selection. 
 * 
 * Wait for players to be paired. The number of paired player will display on screen.
 * An icon will appear on player's screen.
 * 
 * Press A+B to start the infection game. The master will vaccinate the selected percentage of players, choosing at random.
 * Then, the master will pick a random player as patient zero.
 *
 * A player will transmit the disease if close enough (RSSI)
 * and with a certain probability (TRANSMISSIONPROB).
 * if the other players are vaccinated, they will get sick with a certain probability (VACCINATEDPROB), otherwise they will get sick for sure.
 * During the incudation phase (INCUBATION), the player does not show any sign 
 * of illness. After that phase, the sad face shows up.
 * 
 * The game will automatically stop once all players are dead or healthy. The master can
 * also press A+B again to stop the game.
 * 
 * Once the game is over, the micro:bit will show the player id (A,B,C...), health and 
 * who infected him.
 * 
 * Icons used in the game:
 * 
 * Pairing: IconNames.Ghost
 * Paired: IconNames.Happy
 * Dead: IconNames.Skull
 * Sick: IconNames.Sad
 * Incubating: IconNames.Confused
 * Healthy: IconNames.Happy
 * 
 */
const INCUBATION = 20000; // time before showing symptoms
const DEATH = 40000; // time before dying off the disease
const RSSI = -50; // db
const TRANSMISSIONPROB = 40; // % probability to transfer disease
const VACCINATEDPROB = -1; // % probability to get ill if player is vaccinated

const VACCINATED_PERCENTAGE_STEP = 10; // percentage of vaccinated players is a multiple of this quantity

enum GameState {
    Stopped,
    ChoosingVaccinatedPercentage,
    Pairing,
    Running,
    Over
}

enum HealthState {
    Healthy,
    Incubating,
    Sick,
    Dead
}

const GameIcons = {
    Pairing: IconNames.Ghost,
    Paired: IconNames.Happy,
    Dead: IconNames.Skull,
    Sick: IconNames.Sad,
    Incubating: IconNames.Confused,
    Healthy: IconNames.Happy
}

const playerIcons = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
class Player {
    id: number;
    icon: number;
    health: HealthState;
    vaccinated: boolean;
    infected_by: number;
    show() {
        basic.showString(playerIcons[this.icon]);
    }
}

// common state
let state = GameState.Stopped;

// master state
let master = false;
let patientZero: Player;
const players: Player[] = [];
let vaccinatedPercentage = 0;

// player state
let paired = false;
let vaccinated = false;
let infectedBy = -1; // who infected (playerIcon)
let infectedTime = 0; // local time when infection happened
let playerIcon = -1; // player icon and identity
let health = HealthState.Healthy;

// get a player instance (creates one as needed)
function player(id: number): Player {
    for (const p of players)
        if (p.id == id) return p;

    // add player to game
    let p = new Player();
    p.id = id;
    p.icon = (players.length + 1) % playerIcons.length;
    p.health = HealthState.Healthy;
    p.vaccinated = false;
    p.infected_by = -1;
    players.push(p);
    serial.writeLine(`#player ==> ${p.id}`)

    return p;
}

function allDead(): boolean {
    for (const p of players)
        if (p.health == HealthState.Sick || p.health == HealthState.Incubating) return false;
    return true;
}

function gameOver() {
    state = GameState.Over;
    if (patientZero)
        patientZero.show();
    serial.writeLine("== game over ==");
}

function gameFace() {
    switch (state) {
        case GameState.Stopped:
            basic.showIcon(GameIcons.Pairing);
            break;
        case GameState.Pairing:
            if (playerIcon > -1)
                basic.showString(playerIcons[playerIcon]);
            else
                basic.showIcon(paired ? GameIcons.Paired : GameIcons.Pairing, 1);
            break;
        case GameState.Running:
            switch (health) {
                case HealthState.Dead:
                    basic.showIcon(GameIcons.Dead, 1);
                    break;
                case HealthState.Sick:
                    basic.showIcon(GameIcons.Sick, 1);
                    break;
                default:
                    basic.showIcon(GameIcons.Healthy, 1);
                    break;
            }
            break;
        case GameState.Over:
            // show id
            basic.showString(playerIcons[playerIcon]);
            basic.pause(2000);
            // show health
            switch (health) {
                case HealthState.Dead:
                    basic.showIcon(GameIcons.Dead, 2000);
                    break;
                case HealthState.Sick:
                    basic.showIcon(GameIcons.Sick, 2000);
                    break;
                case HealthState.Incubating:
                    basic.showIcon(GameIcons.Incubating, 2000);
                    break;
                default:
                    basic.showIcon(GameIcons.Healthy, 2000);
                    break;
            }
            break;
    }
}

/*
 * 
 * master button controllers
 *
 * Effect of pressing buttons, in sequence:
 * 
 * A+B : register as master and start vaccinated percentage selection.
 * A   : decreases vaccinated percentage selection.
 * B   : increases vaccinated percentage selection.
 * A+B : confirm vaccinated percentage selection and start pairing.
 * A+B : start game.
 * A+B : stop game
 * 
 * */
input.onButtonPressed(Button.A, () => {
    if (state == GameState.ChoosingVaccinatedPercentage) {
        vaccinatedPercentage -= VACCINATED_PERCENTAGE_STEP;

        if (vaccinatedPercentage < 0) {
            vaccinatedPercentage = 0;
        }
        basic.showNumber(vaccinatedPercentage);
    }
})

input.onButtonPressed(Button.B, () => {
    if (state == GameState.ChoosingVaccinatedPercentage) {
        vaccinatedPercentage += VACCINATED_PERCENTAGE_STEP;

        if (vaccinatedPercentage > 100) {
            vaccinatedPercentage = 100;
        }
        basic.showNumber(vaccinatedPercentage);
    }
})

input.onButtonPressed(Button.AB, () => {

    // register as master
    if (state == GameState.Stopped && !master) {
        master = true;
        serial.writeLine("#registered as master");
        state = GameState.ChoosingVaccinatedPercentage;
        basic.showNumber(vaccinatedPercentage);
        return;
    }

    if (!master) return; // master only beyond this

    // confirm vaccinated percentage
    if (state == GameState.ChoosingVaccinatedPercentage && master) {
        paired = true;
        state = GameState.Pairing;
        serial.writeLine(`#vaccinated percentage choosed: ${vaccinatedPercentage}`);
        radio.setTransmitPower(7); // beef up master signal
        basic.showString("0");
        return;
    }

    // launch game
    if (state == GameState.Pairing) {
        // pick the selected percentage of vaccinated players and vaccinate them
        let number_of_vaccinated_players = players.length * vaccinatedPercentage / 100;
        serial.writeLine(`#number of vaccinated players: ${number_of_vaccinated_players} `);
        for (let i = 0; i < number_of_vaccinated_players; ++i) {
            let vaccinated_player = players[i];
            while (!vaccinated_player.vaccinated) {
                radio.sendValue("vaccine", vaccinated_player.id);
                basic.pause(100);
            }
        }

        serial.writeLine("== nodes information ==");

        // pick 1 player and infect him
        let patient_zero_index = Math.random(players.length);
        patientZero = players[patient_zero_index];
        while (patientZero.health == HealthState.Healthy) {
            radio.sendValue("infect", patientZero.id);
            basic.pause(100);
        }
        serial.writeLine(`${playerIcons[players[patient_zero_index].icon]}\tPATIENTZERO`);

        for (let i = 0; i < number_of_vaccinated_players; ++i) {
            if (i != patient_zero_index) {
                serial.writeLine(`${playerIcons[players[i].icon]}\tVACCINED`);
            }
        }

        for (let i = number_of_vaccinated_players; i < players.length; ++i) {
            if (i != patient_zero_index) {
                serial.writeLine(`${playerIcons[players[i].icon]}\tNORMAL`);
            }
        }

        serial.writeLine("== arcs information ==");

        // all ready
        state = GameState.Running;
        serial.writeLine(`#game started ${players.length} players`);

        // show startup
        basic.showIcon(GameIcons.Dead);
    } // end game 
    else if (state == GameState.Running) {
        gameOver();
    }
})

radio.setGroup(42);
radio.setTransmitSerialNumber(true)
radio.onDataPacketReceived(({ time, receivedNumber, receivedString, signal, serial: id }) => {
    if (master) {
        if (receivedString == "pair") {
            // register player
            let n = players.length;
            let p = player(id);
            // show player number if changed
            if (n != players.length) {
                led.stopAnimation();
                basic.showNumber(players.length);
            }
        }
        else if (receivedString == "health") {
            let p = player(id);
            p.health = receivedNumber;
            // check if all infected died
            if (state == GameState.Running && allDead()) {
                gameOver();
            }
        }
        else if (receivedString == "vaccinated") {
            let p = player(id);
            p.vaccinated = true;
        }
        else if (receivedString == "infected-by") {
            let p = player(id);
            if (p.infected_by < 0) {
                p.infected_by = receivedNumber;
                let targetIcon = p.icon;
                serial.writeLine(`${playerIcons[receivedNumber]}\tINFECTED\t${playerIcons[targetIcon]}`);
            }
        }
        else if (receivedString == "tried") {
            let p = player(id);
            let targetIcon = p.icon;
            serial.writeLine(`${playerIcons[receivedNumber]}\tTRIED\t${playerIcons[targetIcon]}`);
        }
    }
    // player 
    else {
        if (receivedString == "state") {
            // update game state
            state = receivedNumber as GameState;
        } else if (infectedBy < 0 &&
            receivedString == "infect"
            && receivedNumber == control.deviceSerialNumber()) {
            infectedBy = 0; // infected by master
            infectedTime = input.runningTime();
            health = HealthState.Incubating;
            serial.writeLine(`infected ${control.deviceSerialNumber()}`);
        } else if (!vaccinated &&
            receivedString == "vaccine"
            && receivedNumber == control.deviceSerialNumber()) {
            vaccinated = true;
            serial.writeLine(`vaccinated ${control.deviceSerialNumber()}`);
        }

        if (receivedString == "h" + control.deviceSerialNumber().toString() &&
            health < receivedNumber) {
            health = receivedNumber;
        }
        switch (state) {
            case GameState.Pairing:
                // medium range in pairing mode
                if (!paired &&
                    receivedString == "paired"
                    && receivedNumber == control.deviceSerialNumber()) {
                    // paired!
                    serial.writeLine(`player paired ==> ${control.deviceSerialNumber()}`)
                    paired = true;
                    return;
                }
                else if (paired && receivedString == "i" + control.deviceSerialNumber().toString()) {
                    playerIcon = receivedNumber;
                }
                break;
            case GameState.Running:
                // broadcast infection status
                if (health == HealthState.Healthy && receivedString == "transmit") {
                    serial.writeLine(`signal: ${signal}`);
                    if (signal > RSSI &&
                        Math.random(100) < TRANSMISSIONPROB) {
                        // if not vaccinated, get sick for sure. If vaccinated, get sick only with probability VACCINATEDPROB
                        if (!vaccinated || Math.random(100) < VACCINATEDPROB) {
                            infectedBy = receivedNumber;
                            infectedTime = input.runningTime();
                            health = HealthState.Incubating;
                        }
                        else if (vaccinated) {
                            radio.sendValue("tried", receivedNumber);
                        }
                    }
                } else if (health != HealthState.Dead
                    && receivedString == "health" && signal > RSSI) {
                    game.addScore(1);
                }
                break;
        }
    }
})

// main game loop
basic.forever(() => {
    if (master) {
        switch (state) {
            case GameState.Pairing:
                // tell each player they are registered
                for (const p of players) {
                    radio.sendValue("paired", p.id);
                    radio.sendValue("i" + p.id, p.icon);
                }
                serial.writeLine(`#pairing ${players.length} players`);
                basic.pause(500);
                break;
            case GameState.Running:
                for (const p of players) {
                    radio.sendValue("h" + p.id, p.health);
                }
                break;
            case GameState.Over:
                if (patientZero)
                    patientZero.show();
                break;
        }
        radio.sendValue("state", state); // keep broadcasting the game state
    } else { // player loop
        switch (state) {
            case GameState.Pairing:
                // broadcast player id
                if (playerIcon < 0)
                    radio.sendValue("pair", control.deviceSerialNumber());
                else if (infectedBy > -1)
                    radio.sendValue("health", health);
                if (vaccinated) {
                    radio.sendValue("vaccinated", 1);
                }
                break;
            case GameState.Running:
                // update health status
                if (health != HealthState.Healthy && input.runningTime() - infectedTime > DEATH)
                    health = HealthState.Dead;
                else if (health != HealthState.Healthy && input.runningTime() - infectedTime > INCUBATION)
                    health = HealthState.Sick;
                // transmit disease
                if (health == HealthState.Incubating || health == HealthState.Sick)
                    radio.sendValue("transmit", playerIcon);
                radio.sendValue("health", health);
                if (infectedBy > 0) {
                    radio.sendValue("infected-by", infectedBy);
                }
                break;
        }
        // show current animation
        gameFace();
    }
})

serial.writeLine("== restarted ==");
basic.showIcon(GameIcons.Pairing)
