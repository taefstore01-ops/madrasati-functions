    res.status(404).json({ error: 'This exam is not available.' });
    return;
  }
  const exam = examSnap.data();

  if (exam.restrictedStudentUid && exam.restrictedStudentUid !== uid) {
    res.status(403).json({
      error: 'This exam is restricted to a specific student.',
      restricted: true,
    });
    return;
  }

  const now = Date.now();
  if (exam.scheduledStartAt && now < exam.scheduledStartAt) {
    res.status(403).json({
      error: 'This exam has not started yet.',
      notStarted: true,
      scheduledStartAt: exam.scheduledStartAt,
    });
    return;
  }
  if (exam.scheduledEndAt && now > exam.scheduledEndAt) {
    res.status(403).json({
      error: 'This exam has ended.',
      ended: true,
    });
    return;
  }

  const attemptsAllowed = (exam.settings && exam.settings.attemptsAllowed) || 1;
  const priorAttempts = await examRef
    .collection('attempts')
    .where('studentUid', '==', uid)
    .get();
  if (priorAttempts.size >= attemptsAllowed) {
    res.status(403).json({ error: 'You have no attempts left for this exam.' });
    return;
  }

  const questionsSnap = await examRef.collection('questions').orderBy('order').get();
  const questions = questionsSnap.docs.map((d) => {
    const q = d.data();
    return {
      id: d.id,
      type: q.type,
      text: q.text,
      options: q.options || null,
      optionImageUrls: q.optionImageUrls || null,
      points: q.points || 1,
    };
  });

  // Shuffle question order per attempt so students sitting together see a
  // different sequence — grading is keyed by question id, unaffected by order.
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  const attemptRef = await examRef.collection('attempts').add({
    studentUid: uid,
    studentDisplayName: displayName,
    status: 'in_progress',
    answers: {},
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  let watermarkText = displayName;
  const userSnap = await db.collection('users').doc(uid).get();
  if (userSnap.exists && userSnap.data().nationalId) {
    watermarkText = `${displayName} - ${userSnap.data().nationalId}`;
  }

  res.status(200).json({
    attemptId: attemptRef.id,
    examId,
    examTitle: exam.title,
    subject: exam.subject,
    teacherWhatsApp: exam.teacherWhatsApp || null,
    timeLimitMinutes: (exam.settings && exam.settings.timeLimitMinutes) || null,
    watermarkText,
    questions,
  });
});

app.post('/submitExamAttempt', async (req, res) => {
  const uid = await verifyAuth(req, res);
  if (!uid) return;

  const examId = req.body && req.body.examId;
  const attemptId = req.body && req.body.attemptId;
  const answers = (req.body && req.body.answers) || {};
  const tabSwitchCount = Math.max(0, Math.min(999, Number(req.body && req.body.tabSwitchCount) || 0));
  if (!examId || !attemptId) {
    res.status(400).json({ error: 'examId and attemptId are required.' });
    return;
  }

  const examRef = db.collection('exams').doc(examId);
  const attemptRef = examRef.collection('attempts').doc(attemptId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const attemptSnap = await tx.get(attemptRef);
      if (!attemptSnap.exists) {
        throw { httpStatus: 404, message: 'Attempt not found.' };
      }
      const attempt = attemptSnap.data();
      if (attempt.studentUid !== uid) {
        throw { httpStatus: 403, message: 'Not your attempt.' };
      }

      const examSnap = await tx.get(examRef);
      const exam = examSnap.data() || {};
      const showResult = exam.showResultToStudent !== false;

      if (attempt.status === 'submitted') {
        // Already graded — immutable. Return the existing score instead of
        // re-grading, so a duplicate submit can never change the result.
        return showResult
          ? { score: attempt.score, totalPoints: attempt.totalPoints, alreadySubmitted: true }
          : { hidden: true, alreadySubmitted: true };
      }

      const questionsSnap = await tx.get(examRef.collection('questions'));
      let score = 0;
      let totalPoints = 0;
      questionsSnap.docs.forEach((qDoc) => {
        const q = qDoc.data();
        const points = q.points || 1;
        totalPoints += points;
        const studentAnswer = answers[qDoc.id];
        if (studentAnswer !== undefined && studentAnswer === q.correctAnswer) {
          score += points;
        }
      });

      const submittedAt = admin.firestore.FieldValue.serverTimestamp();
      tx.update(attemptRef, {
        answers,
        score,
        totalPoints,
        tabSwitchCount,
        status: 'submitted',
        submittedAt,
      });
      tx.set(
        db.collection('studentAttempts').doc(uid).collection('records').doc(attemptId),
        {
          examId,
          examTitle: exam.title || '',
          subject: exam.subject || '',
          hidden: !showResult,
          ...(showResult ? { score, totalPoints } : {}),
          submittedAt,
        }
      );

      return showResult
        ? { score, totalPoints, alreadySubmitted: false }
        : { hidden: true, alreadySubmitted: false };
    });

    res.status(200).json(result);
  } catch (error) {
    const status = error.httpStatus || 500;
    res.status(status).json({ error: error.message || 'Submission failed.' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`generateQuestions service listening on port ${port}`);
});
    res.status(404).json({ error: 'This exam is not available.' });
    return;
  }
  const exam = examSnap.data();

  if (exam.restrictedStudentUid && exam.restrictedStudentUid !== uid) {
    res.status(403).json({
      error: 'This exam is restricted to a specific student.',
      restricted: true,
    });
    return;
  }

  const now = Date.now();
  if (exam.scheduledStartAt && now < exam.scheduledStartAt) {
    res.status(403).json({
      error: 'This exam has not started yet.',
      notStarted: true,
      scheduledStartAt: exam.scheduledStartAt,
    });
    return;
  }
  if (exam.scheduledEndAt && now > exam.scheduledEndAt) {
    res.status(403).json({
      error: 'This exam has ended.',
      ended: true,
    });
    return;
  }

  const attemptsAllowed = (exam.settings && exam.settings.attemptsAllowed) || 1;
  const priorAttempts = await examRef
    .collection('attempts')
    .where('studentUid', '==', uid)
    .get();
  if (priorAttempts.size >= attemptsAllowed) {
    res.status(403).json({ error: 'You have no attempts left for this exam.' });
    return;
  }

  const questionsSnap = await examRef.collection('questions').orderBy('order').get();
  const questions = questionsSnap.docs.map((d) => {
    const q = d.data();
    return {
      id: d.id,
      type: q.type,
      text: q.text,
      options: q.options || null,
      optionImageUrls: q.optionImageUrls || null,
      points: q.points || 1,
    };
  });

  // Shuffle question order per attempt so students sitting together see a
  // different sequence — grading is keyed by question id, unaffected by order.
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  const attemptRef = await examRef.collection('attempts').add({
    studentUid: uid,
    studentDisplayName: displayName,
    status: 'in_progress',
    answers: {},
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  let watermarkText = displayName;
  const userSnap = await db.collection('users').doc(uid).get();
  if (userSnap.exists && userSnap.data().nationalId) {
    watermarkText = `${displayName} - ${userSnap.data().nationalId}`;
  }

  res.status(200).json({
    attemptId: attemptRef.id,
    examId,
    examTitle: exam.title,
    subject: exam.subject,
    teacherWhatsApp: exam.teacherWhatsApp || null,
    timeLimitMinutes: (exam.settings && exam.settings.timeLimitMinutes) || null,
    watermarkText,
    questions,
  });
});

app.post('/submitExamAttempt', async (req, res) => {
  const uid = await verifyAuth(req, res);
  if (!uid) return;

  const examId = req.body && req.body.examId;
  const attemptId = req.body && req.body.attemptId;
  const answers = (req.body && req.body.answers) || {};
  const tabSwitchCount = Math.max(0, Math.min(999, Number(req.body && req.body.tabSwitchCount) || 0));
  if (!examId || !attemptId) {
    res.status(400).json({ error: 'examId and attemptId are required.' });
    return;
  }

  const examRef = db.collection('exams').doc(examId);
  const attemptRef = examRef.collection('attempts').doc(attemptId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const attemptSnap = await tx.get(attemptRef);
      if (!attemptSnap.exists) {
        throw { httpStatus: 404, message: 'Attempt not found.' };
      }
      const attempt = attemptSnap.data();
      if (attempt.studentUid !== uid) {
        throw { httpStatus: 403, message: 'Not your attempt.' };
      }

      const examSnap = await tx.get(examRef);
      const exam = examSnap.data() || {};
      const showResult = exam.showResultToStudent !== false;

      if (attempt.status === 'submitted') {
        // Already graded — immutable. Return the existing score instead of
        // re-grading, so a duplicate submit can never change the result.
        return showResult
          ? { score: attempt.score, totalPoints: attempt.totalPoints, alreadySubmitted: true }
          : { hidden: true, alreadySubmitted: true };
      }

      const questionsSnap = await tx.get(examRef.collection('questions'));
      let score = 0;
      let totalPoints = 0;
      questionsSnap.docs.forEach((qDoc) => {
        const q = qDoc.data();
        const points = q.points || 1;
        totalPoints += points;
        const studentAnswer = answers[qDoc.id];
        if (studentAnswer !== undefined && studentAnswer === q.correctAnswer) {
          score += points;
        }
      });

      const submittedAt = admin.firestore.FieldValue.serverTimestamp();
      tx.update(attemptRef, {
        answers,
        score,
        totalPoints,
        tabSwitchCount,
        status: 'submitted',
        submittedAt,
      });
      tx.set(
        db.collection('studentAttempts').doc(uid).collection('records').doc(attemptId),
        {
          examId,
          examTitle: exam.title || '',
          subject: exam.subject || '',
          hidden: !showResult,
          ...(showResult ? { score, totalPoints } : {}),
          submittedAt,
        }
      );

      return showResult
        ? { score, totalPoints, alreadySubmitted: false }
        : { hidden: true, alreadySubmitted: false };
    });

    res.status(200).json(result);
  } catch (error) {
    const status = error.httpStatus || 500;
    res.status(status).json({ error: error.message || 'Submission failed.' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`generateQuestions service listening on port ${port}`);
});
    res.status(404).json({ error: 'This exam is not available.' });
    return;
  }
  const exam = examSnap.data();

  if (exam.restrictedStudentUid && exam.restrictedStudentUid !== uid) {
    res.status(403).json({
      error: 'This exam is restricted to a specific student.',
      restricted: true,
    });
    return;
  }

  const now = Date.now();
  if (exam.scheduledStartAt && now < exam.scheduledStartAt) {
    res.status(403).json({
      error: 'This exam has not started yet.',
      notStarted: true,
      scheduledStartAt: exam.scheduledStartAt,
    });
    return;
  }
  if (exam.scheduledEndAt && now > exam.scheduledEndAt) {
    res.status(403).json({
      error: 'This exam has ended.',
      ended: true,
    });
    return;
  }

  const attemptsAllowed = (exam.settings && exam.settings.attemptsAllowed) || 1;
  const priorAttempts = await examRef
    .collection('attempts')
    .where('studentUid', '==', uid)
    .get();
  if (priorAttempts.size >= attemptsAllowed) {
    res.status(403).json({ error: 'You have no attempts left for this exam.' });
    return;
  }

  const questionsSnap = await examRef.collection('questions').orderBy('order').get();
  const questions = questionsSnap.docs.map((d) => {
    const q = d.data();
    return {
      id: d.id,
      type: q.type,
      text: q.text,
      options: q.options || null,
      optionImageUrls: q.optionImageUrls || null,
      points: q.points || 1,
    };
  });

  // Shuffle question order per attempt so students sitting together see a
  // different sequence — grading is keyed by question id, unaffected by order.
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  const attemptRef = await examRef.collection('attempts').add({
    studentUid: uid,
    studentDisplayName: displayName,
    status: 'in_progress',
    answers: {},
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  let watermarkText = displayName;
  const userSnap = await db.collection('users').doc(uid).get();
  if (userSnap.exists && userSnap.data().nationalId) {
    watermarkText = `${displayName} - ${userSnap.data().nationalId}`;
  }

  res.status(200).json({
    attemptId: attemptRef.id,
    examId,
    examTitle: exam.title,
    subject: exam.subject,
    teacherWhatsApp: exam.teacherWhatsApp || null,
    timeLimitMinutes: (exam.settings && exam.settings.timeLimitMinutes) || null,
    watermarkText,
    questions,
  });
});

app.post('/submitExamAttempt', async (req, res) => {
  const uid = await verifyAuth(req, res);
  if (!uid) return;

  const examId = req.body && req.body.examId;
  const attemptId = req.body && req.body.attemptId;
  const answers = (req.body && req.body.answers) || {};
  const tabSwitchCount = Math.max(0, Math.min(999, Number(req.body && req.body.tabSwitchCount) || 0));
  if (!examId || !attemptId) {
    res.status(400).json({ error: 'examId and attemptId are required.' });
    return;
  }

  const examRef = db.collection('exams').doc(examId);
  const attemptRef = examRef.collection('attempts').doc(attemptId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const attemptSnap = await tx.get(attemptRef);
      if (!attemptSnap.exists) {
        throw { httpStatus: 404, message: 'Attempt not found.' };
      }
      const attempt = attemptSnap.data();
      if (attempt.studentUid !== uid) {
        throw { httpStatus: 403, message: 'Not your attempt.' };
      }

      const examSnap = await tx.get(examRef);
      const exam = examSnap.data() || {};
      const showResult = exam.showResultToStudent !== false;

      if (attempt.status === 'submitted') {
        // Already graded — immutable. Return the existing score instead of
        // re-grading, so a duplicate submit can never change the result.
        return showResult
          ? { score: attempt.score, totalPoints: attempt.totalPoints, alreadySubmitted: true }
          : { hidden: true, alreadySubmitted: true };
      }

      const questionsSnap = await tx.get(examRef.collection('questions'));
      let score = 0;
      let totalPoints = 0;
      questionsSnap.docs.forEach((qDoc) => {
        const q = qDoc.data();
        const points = q.points || 1;
        totalPoints += points;
        const studentAnswer = answers[qDoc.id];
        if (studentAnswer !== undefined && studentAnswer === q.correctAnswer) {
          score += points;
        }
      });

      const submittedAt = admin.firestore.FieldValue.serverTimestamp();
      tx.update(attemptRef, {
        answers,
        score,
        totalPoints,
        tabSwitchCount,
        status: 'submitted',
        submittedAt,
      });
      tx.set(
        db.collection('studentAttempts').doc(uid).collection('records').doc(attemptId),
        {
          examId,
          examTitle: exam.title || '',
          subject: exam.subject || '',
          hidden: !showResult,
          ...(showResult ? { score, totalPoints } : {}),
          submittedAt,
        }
      );

      return showResult
        ? { score, totalPoints, alreadySubmitted: false }
        : { hidden: true, alreadySubmitted: false };
    });

    res.status(200).json(result);
  } catch (error) {
    const status = error.httpStatus || 500;
    res.status(status).json({ error: error.message || 'Submission failed.' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`generateQuestions service listening on port ${port}`);
});
    res.status(404).json({ error: 'This exam is not available.' });
    return;
  }
  const exam = examSnap.data();

  if (exam.restrictedStudentUid && exam.restrictedStudentUid !== uid) {
    res.status(403).json({
      error: 'This exam is restricted to a specific student.',
      restricted: true,
    });
    return;
  }

  const now = Date.now();
  if (exam.scheduledStartAt && now < exam.scheduledStartAt) {
    res.status(403).json({
      error: 'This exam has not started yet.',
      notStarted: true,
      scheduledStartAt: exam.scheduledStartAt,
    });
    return;
  }
  if (exam.scheduledEndAt && now > exam.scheduledEndAt) {
    res.status(403).json({
      error: 'This exam has ended.',
      ended: true,
    });
    return;
  }

  const attemptsAllowed = (exam.settings && exam.settings.attemptsAllowed) || 1;
  const priorAttempts = await examRef
    .collection('attempts')
    .where('studentUid', '==', uid)
    .get();
  if (priorAttempts.size >= attemptsAllowed) {
    res.status(403).json({ error: 'You have no attempts left for this exam.' });
    return;
  }

  const questionsSnap = await examRef.collection('questions').orderBy('order').get();
  const questions = questionsSnap.docs.map((d) => {
    const q = d.data();
    return {
      id: d.id,
      type: q.type,
      text: q.text,
      options: q.options || null,
      optionImageUrls: q.optionImageUrls || null,
      points: q.points || 1,
    };
  });

  // Shuffle question order per attempt so students sitting together see a
  // different sequence — grading is keyed by question id, unaffected by order.
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  const attemptRef = await examRef.collection('attempts').add({
    studentUid: uid,
    studentDisplayName: displayName,
    status: 'in_progress',
    answers: {},
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  let watermarkText = displayName;
  const userSnap = await db.collection('users').doc(uid).get();
  if (userSnap.exists && userSnap.data().nationalId) {
    watermarkText = `${displayName} - ${userSnap.data().nationalId}`;
  }

  res.status(200).json({
    attemptId: attemptRef.id,
    examId,
    examTitle: exam.title,
    subject: exam.subject,
    teacherWhatsApp: exam.teacherWhatsApp || null,
    timeLimitMinutes: (exam.settings && exam.settings.timeLimitMinutes) || null,
    watermarkText,
    questions,
  });
});

app.post('/submitExamAttempt', async (req, res) => {
  const uid = await verifyAuth(req, res);
  if (!uid) return;

  const examId = req.body && req.body.examId;
  const attemptId = req.body && req.body.attemptId;
  const answers = (req.body && req.body.answers) || {};
  const tabSwitchCount = Math.max(0, Math.min(999, Number(req.body && req.body.tabSwitchCount) || 0));
  if (!examId || !attemptId) {
    res.status(400).json({ error: 'examId and attemptId are required.' });
    return;
  }

  const examRef = db.collection('exams').doc(examId);
  const attemptRef = examRef.collection('attempts').doc(attemptId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const attemptSnap = await tx.get(attemptRef);
      if (!attemptSnap.exists) {
        throw { httpStatus: 404, message: 'Attempt not found.' };
      }
      const attempt = attemptSnap.data();
      if (attempt.studentUid !== uid) {
        throw { httpStatus: 403, message: 'Not your attempt.' };
      }

      const examSnap = await tx.get(examRef);
      const exam = examSnap.data() || {};
      const showResult = exam.showResultToStudent !== false;

      if (attempt.status === 'submitted') {
        // Already graded — immutable. Return the existing score instead of
        // re-grading, so a duplicate submit can never change the result.
        return showResult
          ? { score: attempt.score, totalPoints: attempt.totalPoints, alreadySubmitted: true }
          : { hidden: true, alreadySubmitted: true };
      }

      const questionsSnap = await tx.get(examRef.collection('questions'));
      let score = 0;
      let totalPoints = 0;
      questionsSnap.docs.forEach((qDoc) => {
        const q = qDoc.data();
        const points = q.points || 1;
        totalPoints += points;
        const studentAnswer = answers[qDoc.id];
        if (studentAnswer !== undefined && studentAnswer === q.correctAnswer) {
          score += points;
        }
      });

      const submittedAt = admin.firestore.FieldValue.serverTimestamp();
      tx.update(attemptRef, {
        answers,
        score,
        totalPoints,
        tabSwitchCount,
        status: 'submitted',
        submittedAt,
      });
      tx.set(
        db.collection('studentAttempts').doc(uid).collection('records').doc(attemptId),
        {
          examId,
          examTitle: exam.title || '',
          subject: exam.subject || '',
          hidden: !showResult,
          ...(showResult ? { score, totalPoints } : {}),
          submittedAt,
        }
      );

      return showResult
        ? { score, totalPoints, alreadySubmitted: false }
        : { hidden: true, alreadySubmitted: false };
    });

    res.status(200).json(result);
  } catch (error) {
    const status = error.httpStatus || 500;
    res.status(status).json({ error: error.message || 'Submission failed.' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`generateQuestions service listening on port ${port}`);
});
 };
  });

  // Shuffle question order per attempt so students sitting together see a
  // different sequence — grading is keyed by question id, unaffected by order.
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  const attemptRef = await examRef.collection('attempts').add({
    studentUid: uid,
    studentDisplayName: displayName,
    status: 'in_progress',
    answers: {},
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  let watermarkText = displayName;
  const userSnap = await db.collection('users').doc(uid).get();
  if (userSnap.exists && userSnap.data().nationalId) {
    watermarkText = `${displayName} - ${userSnap.data().nationalId}`;
  }

  res.status(200).json({
    attemptId: attemptRef.id,
    examId,
    examTitle: exam.title,
    subject: exam.subject,
    teacherWhatsApp: exam.teacherWhatsApp || null,
    timeLimitMinutes: (exam.settings && exam.settings.timeLimitMinutes) || null,
    watermarkText,
    questions,
  });
});

app.post('/submitExamAttempt', async (req, res) => {
  const uid = await verifyAuth(req, res);
  if (!uid) return;

  const examId = req.body && req.body.examId;
  const attemptId = req.body && req.body.attemptId;
  const answers = (req.body && req.body.answers) || {};
  const tabSwitchCount = Math.max(0, Math.min(999, Number(req.body && req.body.tabSwitchCount) || 0));
  if (!examId || !attemptId) {
    res.status(400).json({ error: 'examId and attemptId are required.' });
    return;
  }

  const examRef = db.collection('exams').doc(examId);
  const attemptRef = examRef.collection('attempts').doc(attemptId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const attemptSnap = await tx.get(attemptRef);
      if (!attemptSnap.exists) {
        throw { httpStatus: 404, message: 'Attempt not found.' };
      }
      const attempt = attemptSnap.data();
      if (attempt.studentUid !== uid) {
        throw { httpStatus: 403, message: 'Not your attempt.' };
      }

      const examSnap = await tx.get(examRef);
      const exam = examSnap.data() || {};
      const showResult = exam.showResultToStudent !== false;

      if (attempt.status === 'submitted') {
        // Already graded — immutable. Return the existing score instead of
        // re-grading, so a duplicate submit can never change the result.
        return showResult
          ? { score: attempt.score, totalPoints: attempt.totalPoints, alreadySubmitted: true }
          : { hidden: true, alreadySubmitted: true };
      }

      const questionsSnap = await tx.get(examRef.collection('questions'));
      let score = 0;
      let totalPoints = 0;
      questionsSnap.docs.forEach((qDoc) => {
        const q = qDoc.data();
        const points = q.points || 1;
        totalPoints += points;
        const studentAnswer = answers[qDoc.id];
        if (studentAnswer !== undefined && studentAnswer === q.correctAnswer) {
          score += points;
        }
      });

      const submittedAt = admin.firestore.FieldValue.serverTimestamp();
      tx.update(attemptRef, {
        answers,
        score,
        totalPoints,
        tabSwitchCount,
        status: 'submitted',
        submittedAt,
      });
      tx.set(
        db.collection('studentAttempts').doc(uid).collection('records').doc(attemptId),
        {
          examId,
          examTitle: exam.title || '',
          subject: exam.subject || '',
          hidden: !showResult,
          ...(showResult ? { score, totalPoints } : {}),
          submittedAt,
        }
      );

      return showResult
        ? { score, totalPoints, alreadySubmitted: false }
        : { hidden: true, alreadySubmitted: false };
    });

    res.status(200).json(result);
  } catch (error) {
    const status = error.httpStatus || 500;
    res.status(status).json({ error: error.message || 'Submission failed.' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`generateQuestions service listening on port ${port}`);
});
