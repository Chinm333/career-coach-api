## Career Coach API

Take linkedin from me > Extract all details i.e. work history, education etc from linkedin > Extracts plausible skills from my linkedin > Has a conversation to understand what kind of work I love (find out what kind of work the candidate will love and what kind of job will they thrive) > Talks to companies to understand their requirement in natural language > matchmakers candidates with req

#### .env

```
PORT=4000
MONGO_URI= mongodb url
GROQ_API_KEY= groq api key 
GROQ_MODEL=openai/gpt-oss-120b
GEMINI_API_KEY= gemini api key
GEMINI_MODEL=models/gemini-2.0-flash-exp
JWT_ACCESS_SECRET= jwt access key
JWT_REFRESH_SECRET= jwt refresh key
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
```