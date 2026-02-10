.PHONY: dataset test

dataset:
	python scripts/build_dataset.py

test:
	pytest -q
