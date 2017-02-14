FROM python:2-onbuild

EXPOSE 5000

#CMD ["gunicorn", "-w4", "-b", "0.0.0.0", "app:app"]
CMD ["python", "app.py"]
