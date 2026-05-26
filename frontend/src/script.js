let income=0;
let expense=0;

function addTransaction(){

let amount=
parseInt(
document.getElementById(
"amount"
).value
);

let type=
document.getElementById(
"type"
).value;

let list=
document.getElementById(
"transactionList"
);

if(type==="income"){

income+=amount;

}
else{

expense+=amount;

}

document.getElementById(
"income"
).innerText=income;

document.getElementById(
"expense"
).innerText=expense;

document.getElementById(
"balance"
).innerText=
income-expense;

list.innerHTML+=
`<li>${type}: ₹${amount}</li>`;
}