
/*
 * Change attributes on demo elements.
 */
function change(elem, attr) {
	let value = elem.value;
	const demos = document.querySelectorAll('wijit-code.demo');

	switch (attr) {
	case "inline":
		value = (elem.checked) ? 'true' : 'false';
		break;
	case "highlight":
		if (elem.value === 'reset') location.reload();
		break;
	}

	for (const demo of demos) {
		demo.setAttribute(attr, value);
	}
}

/*
 * Toggle "sticky" quality of Demo form inputs
 */
function unstickIfNeeded (target, watched) {
	const stick = document.querySelector('#stick');
	const unstick = document.querySelector('#unstick');
	window.addEventListener('scroll', () => {
		const offset = watched.offsetTop - target.offsetHeight;
		if (window.scrollY > offset) {
			target.classList.remove('sticky');
		} else {
			target.classList.add('sticky');
		}
	});
}

/*
 * Convenience functionality for inputs
 */
function upgradeInputs () {
	const inputs = document.querySelectorAll('input');
	for (const input of inputs) {
		input.addEventListener('focus', event => {
			event.target.select();
		});

		input.addEventListener('click', event => {
			event.target.select();
		});

		input.addEventListener('keydown', event => {
			if (event.key === "Enter") {
				event.target.select();
			}
		})
	}
}

/**
 * Grab the README file and stick it in the "instructions" container
 */
function getReadme () {
	const elem = document.querySelector('#instructions');
	fetch ('./README.md')
	.then (response => response.text())
	.then (text => {
		elem.textContent = text;
	});
}

// unstickIfNeeded(stick, unstick);
upgradeInputs();
getReadme();

