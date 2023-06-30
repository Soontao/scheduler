# Memo

display job with execution logs

```
http://localhost:4004/api/v1/job/Jobs?$expand=tasks,executions($expand=taskExecutions($expand=logs),logs)
```