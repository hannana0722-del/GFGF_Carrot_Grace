"""
GSDF Dashboard - Seed Data Script
Populates the database with sample data for development/testing.

Usage:
    python seed_data.py
"""

import sys
import os

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import date, datetime, timedelta
import random

from app.database import SessionLocal, create_tables
from app.models.models import (
    User, Announcement, AnnouncementRead, HealthCheck,
    Assignment, AssignmentSubmission, Attendance, DailyReport,
    Risk, Notification, AuditLog
)
from app.core.security import get_password_hash


# ─── Sample Data ───────────────────────────────────────────────────────────────

COUNTRIES = ["미국(뉴욕)", "호주", "중국"]

MANAGERS = [
    {"username": "manager_us", "email": "manager.us@gsdf.kr", "full_name": "김민준", "country": "미국(뉴욕)", "team": "US팀"},
    {"username": "manager_au", "email": "manager.au@gsdf.kr", "full_name": "이서연", "country": "호주", "team": "AU팀"},
    {"username": "manager_cn", "email": "manager.cn@gsdf.kr", "full_name": "박지훈", "country": "중국", "team": "CN팀"},
]

KOREAN_FIRST_NAMES = [
    "민준", "서연", "지훈", "수아", "예준", "지민", "현우", "지아",
    "동현", "채원", "준서", "나연", "시우", "하은", "지호", "소연",
    "준혁", "지윤", "민서", "유진", "태양", "수빈", "하준", "다은",
    "건우", "예린", "성민", "혜진", "재원", "은지", "우진", "지수",
    "승현", "민아", "태민", "연우", "진호", "수현", "기현", "서현",
    "도윤", "아름", "찬호", "미소", "현준", "보라", "성호", "주연",
    "재민", "지연"
]

KOREAN_LAST_NAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"]

EMOTION_TAGS = ["행복", "평온", "피곤", "불안", "설렘", "만족", "걱정", "활기", "무기력", "즐거움"]

DAILY_ACTIVITIES = [
    "현지 기업 탐방 및 네트워킹 세션 참여. 현지 스타트업 생태계에 대해 많이 배웠습니다.",
    "어학 수업 및 문화 체험 프로그램 참가. 현지 음식과 문화를 직접 경험했습니다.",
    "멘토링 세션 참여. 현직 전문가로부터 커리어 조언을 받았습니다.",
    "팀 프로젝트 미팅. 공동 발표 자료 준비를 위해 협력했습니다.",
    "현지 대학교 방문 및 강의 청취. 글로벌 교육 시스템에 대해 이해를 높였습니다.",
    "봉사활동 프로그램 참여. 지역 커뮤니티와 교류하며 뿌듯함을 느꼈습니다.",
    "문화 기관 방문(박물관, 갤러리). 현지 역사와 예술에 대한 이해를 넓혔습니다.",
    "어학 실력 향상을 위한 자습 및 언어 교환 파트너와 대화 연습.",
    "현지 청년 단체와의 교류 행사. 다양한 배경을 가진 친구들을 사귀었습니다.",
    "체험 연수 최종 발표 준비. 팀원들과 함께 발표 내용을 정리했습니다.",
]

RISK_DESCRIPTIONS = {
    "health": ["지속적인 두통 호소", "수면 장애 보고", "식욕 감소 및 소화 문제", "심리적 스트레스 증가"],
    "attendance": ["무단 결석 2회 발생", "지각 3회 반복", "조기 퇴장 패턴 발견", "출결 불규칙 지속"],
    "assignment": ["과제 미제출 2건", "과제 품질 저하", "마감 기한 반복 위반", "피드백 미반영"],
    "behavior": ["팀 협력 어려움", "소통 부재", "무기력 및 참여 저하", "갈등 상황 발생"],
}

ANNOUNCEMENT_TITLES = [
    ("프로그램 일정 변경 안내", "all"),
    ("건강 관리 안내사항", "all"),
    ("미국(뉴욕) 팀 특별 활동 안내", "country"),
    ("1기 코호트 과제 제출 안내", "cohort"),
    ("호주 팀 문화 탐방 일정", "country"),
    ("긴급 연락망 확인 요청", "all"),
    ("중국 팀 현지 파트너 미팅", "country"),
    ("2기 코호트 멘토링 일정", "cohort"),
]


def random_date(start: date, end: date) -> date:
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def random_datetime(start: date, end: date) -> datetime:
    d = random_date(start, end)
    h = random.randint(7, 22)
    m = random.randint(0, 59)
    return datetime(d.year, d.month, d.day, h, m)


def make_korean_name() -> str:
    last = random.choice(KOREAN_LAST_NAMES)
    first = random.choice(KOREAN_FIRST_NAMES)
    return f"{last}{first}"


def seed():
    print("=" * 60)
    print("GSDF Dashboard - Seeding Database")
    print("=" * 60)

    create_tables()
    db = SessionLocal()

    try:
        # ── Clear existing data (optional - comment out to keep existing) ──
        print("\n[1/8] Clearing existing seed data...")
        for model in [
            AuditLog, Notification, Risk, DailyReport,
            Attendance, AssignmentSubmission, Assignment,
            HealthCheck, AnnouncementRead, Announcement,
            User
        ]:
            count = db.query(model).delete()
            if count:
                print(f"  Deleted {count} {model.__tablename__} records")
        db.commit()

        # ── Admin User ──────────────────────────────────────────────────────
        print("\n[2/8] Creating admin user...")
        admin = User(
            username="admin",
            email="admin@gsdf.kr",
            hashed_password=get_password_hash("admin123"),
            role="admin",
            full_name="시스템 관리자",
            is_active=True
        )
        db.add(admin)
        db.flush()
        print(f"  Admin: admin / admin123 (id={admin.id})")

        # ── Managers ────────────────────────────────────────────────────────
        print("\n[3/8] Creating managers (인솔자)...")
        manager_users = []
        for i, m_data in enumerate(MANAGERS):
            cohort = (i % 2) + 1  # cohort 1 or 2
            manager = User(
                username=m_data["username"],
                email=m_data["email"],
                hashed_password=get_password_hash("manager123"),
                role="manager",
                full_name=m_data["full_name"],
                country=m_data["country"],
                team=m_data["team"],
                cohort_number=cohort,
                is_active=True
            )
            db.add(manager)
            db.flush()
            manager_users.append(manager)
            print(f"  Manager: {m_data['username']} / manager123 ({m_data['country']}, 코호트{cohort})")

        # ── Participants ─────────────────────────────────────────────────────
        print("\n[4/8] Creating participants (참여자) - 10 per country...")
        all_participants = []
        name_pool = list(range(len(KOREAN_FIRST_NAMES)))

        for country_idx, country in enumerate(COUNTRIES):
            manager = manager_users[country_idx]
            team_name = f"{country[:2]}팀"
            cohort = manager.cohort_number

            for j in range(10):
                p_num = country_idx * 10 + j + 1
                last = random.choice(KOREAN_LAST_NAMES)
                first = KOREAN_FIRST_NAMES[(country_idx * 10 + j) % len(KOREAN_FIRST_NAMES)]
                full_name = f"{last}{first}"

                participant = User(
                    username=f"participant_{country[:2].lower()}_{j+1:02d}",
                    email=f"p{p_num:03d}@gsdf.kr",
                    hashed_password=get_password_hash("part123"),
                    role="participant",
                    full_name=full_name,
                    country=country,
                    team=team_name,
                    cohort_number=cohort,
                    is_active=True
                )
                db.add(participant)
                db.flush()
                all_participants.append(participant)

            print(f"  {country}: 10 participants created (cohort {cohort})")

        db.commit()
        print(f"  Total participants: {len(all_participants)}")

        # ── Announcements ────────────────────────────────────────────────────
        print("\n[5/8] Creating announcements (공지사항)...")
        today = date.today()
        start_date = today - timedelta(days=30)

        announcements = []
        for title, target_type in ANNOUNCEMENT_TITLES:
            target_value = None
            if target_type == "country":
                target_value = random.choice(COUNTRIES)
            elif target_type == "cohort":
                target_value = str(random.randint(1, 2))

            author = random.choice([admin] + manager_users)
            ann = Announcement(
                title=title,
                content=f"[{title}]\n\n안녕하세요, 경기 사다리 청년 재단 참가자 여러분.\n\n{title}에 관하여 아래와 같이 안내드립니다.\n\n자세한 내용은 담당 인솔자에게 문의해 주시기 바랍니다.\n\n감사합니다.\n경기 사다리 청년 재단 운영팀",
                target_type=target_type,
                target_value=target_value,
                author_id=author.id,
                is_scheduled=False,
                sent_at=datetime.combine(random_date(start_date, today), datetime.min.time().replace(hour=9))
            )
            db.add(ann)
            db.flush()
            announcements.append(ann)

            # Some reads
            readers = random.sample(all_participants, min(random.randint(3, 10), len(all_participants)))
            for reader in readers:
                read = AnnouncementRead(
                    announcement_id=ann.id,
                    user_id=reader.id
                )
                db.add(read)

        db.commit()
        print(f"  Created {len(announcements)} announcements")

        # ── Health Checks ────────────────────────────────────────────────────
        print("\n[6/8] Creating health checks (건강 체크)...")
        hc_count = 0
        for days_ago in range(14):
            check_date = today - timedelta(days=days_ago)
            # ~80% of participants submit health checks
            submitters = random.sample(all_participants, int(len(all_participants) * 0.8))

            for participant in submitters:
                # Weighted towards green
                color_weights = [0.7, 0.2, 0.1]
                signal = random.choices(["green", "yellow", "red"], weights=color_weights)[0]
                emergency = signal == "red" and random.random() < 0.3

                score = random.randint(1, 5)
                mood = random.randint(1, 10)

                hc = HealthCheck(
                    user_id=participant.id,
                    check_date=check_date,
                    survey_type="daily",
                    responses={
                        "physical_score": score,
                        "mood_score": mood,
                        "sleep_hours": random.randint(5, 9),
                        "appetite": random.choice(["좋음", "보통", "나쁨"]),
                        "symptoms": random.choice(["없음", "두통", "피로", "소화불량", "없음", "없음"]),
                        "stress_level": random.randint(1, 10)
                    },
                    signal_color=signal,
                    emergency_requested=emergency,
                    notes="오늘도 건강하게 활동했습니다." if signal == "green" else None
                )
                db.add(hc)
                hc_count += 1

        db.commit()
        print(f"  Created {hc_count} health check records")

        # ── Assignments ───────────────────────────────────────────────────────
        print("\n[7/8] Creating assignments & submissions (과제)...")
        assignment_data = [
            ("자기소개 에세이", "현지 생활 2주차 소감과 자기소개를 1000자 이상으로 작성하세요.", 1),
            ("현지 기업 분석 보고서", "방문한 현지 기업 중 하나를 선택하여 분석 보고서를 작성하세요.", None),
            ("문화 체험 일지", "현지 문화 체험 활동 중 가장 인상적이었던 경험을 정리하여 제출하세요.", None),
            ("네트워킹 결과 보고", "현지 멘토/파트너와의 네트워킹 활동 결과를 정리하세요.", 2),
            ("최종 발표 자료", "프로그램 전체를 돌아보는 최종 발표 자료를 팀별로 제출하세요.", None),
        ]

        assignments = []
        for title, desc, cohort_num in assignment_data:
            due = datetime.combine(today + timedelta(days=random.randint(-5, 14)), datetime.min.time().replace(hour=23, minute=59))
            a = Assignment(
                title=title,
                description=desc,
                cohort_number=cohort_num,
                due_date=due,
                created_by=admin.id
            )
            db.add(a)
            db.flush()
            assignments.append(a)

            # Create submissions for eligible participants
            eligible = all_participants
            if cohort_num:
                eligible = [p for p in all_participants if p.cohort_number == cohort_num]

            for participant in eligible:
                rand = random.random()
                if rand < 0.65:  # 65% submitted
                    status = "submitted"
                    if due < datetime.utcnow():
                        status = random.choice(["submitted", "late"])
                    sub = AssignmentSubmission(
                        assignment_id=a.id,
                        user_id=participant.id,
                        content=f"{participant.full_name}의 {title} 제출물입니다.\n\n" + random.choice(DAILY_ACTIVITIES),
                        status=status,
                        submitted_at=random_datetime(today - timedelta(days=10), today),
                        score=round(random.uniform(70, 100), 1) if random.random() > 0.3 else None,
                        feedback="잘 작성했습니다." if random.random() > 0.5 else None
                    )
                    db.add(sub)
                elif rand < 0.8:  # 15% late
                    sub = AssignmentSubmission(
                        assignment_id=a.id,
                        user_id=participant.id,
                        content=f"늦게 제출하는 {title}입니다. 죄송합니다.",
                        status="late",
                        submitted_at=datetime.utcnow() - timedelta(hours=random.randint(1, 48))
                    )
                    db.add(sub)
                # remaining ~20% = missing (no submission record)

        db.commit()
        print(f"  Created {len(assignments)} assignments with submissions")

        # ── Attendance ────────────────────────────────────────────────────────
        print("\n[8/8] Creating attendance records (출결)...")
        att_count = 0
        session_types = ["오전", "오후", "워크숍"]

        for days_ago in range(20):
            session_date = today - timedelta(days=days_ago)
            if session_date.weekday() >= 5:  # Skip weekends
                continue

            session_type = random.choice(session_types)
            # ~85% of participants attend
            attendees = random.sample(all_participants, int(len(all_participants) * 0.85))

            for participant in attendees:
                rand = random.random()
                if rand < 0.80:
                    status = "present"
                elif rand < 0.90:
                    status = "late"
                elif rand < 0.95:
                    status = "early_leave"
                else:
                    status = "absent"

                check_in = None
                check_out = None
                if status in ("present", "late"):
                    hour = 9 if status == "present" else random.randint(10, 11)
                    check_in = datetime(session_date.year, session_date.month, session_date.day, hour, random.randint(0, 59))
                    check_out = check_in + timedelta(hours=random.randint(4, 8))

                manager_for_country = next(
                    (m for m in manager_users if m.country == participant.country), None
                )

                att = Attendance(
                    user_id=participant.id,
                    session_date=session_date,
                    session_type=session_type,
                    check_in_time=check_in,
                    check_out_time=check_out,
                    status=status,
                    reason="개인 사정" if status == "absent" else None,
                    method=random.choice(["qr", "manual"]),
                    recorded_by=manager_for_country.id if manager_for_country else admin.id
                )
                db.add(att)
                att_count += 1

        db.commit()
        print(f"  Created {att_count} attendance records")

        # ── Daily Reports ─────────────────────────────────────────────────────
        print("\n[+] Creating daily reports (일일 보고)...")
        dr_count = 0

        for days_ago in range(14):
            report_date = today - timedelta(days=days_ago)
            if report_date.weekday() >= 5:
                continue

            submitters = random.sample(all_participants, int(len(all_participants) * 0.75))

            for participant in submitters:
                emotion = random.choice(EMOTION_TAGS)
                score = random.randint(2, 5)
                activity = random.choice(DAILY_ACTIVITIES)

                dr = DailyReport(
                    user_id=participant.id,
                    report_date=report_date,
                    activities=activity,
                    emotion_tag=emotion,
                    satisfaction_score=score,
                    photo_urls=[],
                    role_type="participant",
                    submitted_at=datetime(report_date.year, report_date.month, report_date.day, 21, random.randint(0, 59))
                )
                db.add(dr)
                dr_count += 1

        # Manager daily reports
        for manager in manager_users:
            for days_ago in range(7):
                report_date = today - timedelta(days=days_ago)
                if report_date.weekday() >= 5:
                    continue

                dr = DailyReport(
                    user_id=manager.id,
                    report_date=report_date,
                    activities=f"{manager.country} 팀 {days_ago+1}일차 인솔 보고. 전체적으로 원활하게 진행되었습니다. 팀원들의 적응 상태 양호.",
                    emotion_tag="만족",
                    satisfaction_score=random.randint(3, 5),
                    role_type="manager",
                    manager_id=manager.id,
                    submitted_at=datetime(report_date.year, report_date.month, report_date.day, 22, 0)
                )
                db.add(dr)
                dr_count += 1

        db.commit()
        print(f"  Created {dr_count} daily report records")

        # ── Risks ────────────────────────────────────────────────────────────
        print("\n[+] Creating risk records (리스크 신호등)...")
        risk_count = 0
        issue_types = ["health", "attendance", "assignment", "behavior"]

        # Create risks for ~30% of participants
        risk_participants = random.sample(all_participants, int(len(all_participants) * 0.3))

        for participant in risk_participants:
            issue_type = random.choice(issue_types)
            priority = random.choices(["high", "medium", "low"], weights=[0.2, 0.5, 0.3])[0]
            status = random.choices(["red", "yellow", "green"], weights=[0.3, 0.5, 0.2])[0]
            desc = random.choice(RISK_DESCRIPTIONS.get(issue_type, ["기타 사항"]))

            manager_for_p = next(
                (m for m in manager_users if m.country == participant.country), admin
            )

            risk = Risk(
                user_id=participant.id,
                issue_type=issue_type,
                priority=priority,
                status=status,
                description=f"{participant.full_name}: {desc}",
                action_history=[
                    {
                        "action": "초기 상담 진행",
                        "taken_by": manager_for_p.username,
                        "taken_by_id": manager_for_p.id,
                        "timestamp": (datetime.utcnow() - timedelta(days=2)).isoformat(),
                        "notes": "참가자와 면담을 통해 상황을 파악했습니다."
                    }
                ],
                last_updated_by=manager_for_p.id,
                created_at=datetime.utcnow() - timedelta(days=random.randint(1, 14))
            )
            db.add(risk)
            risk_count += 1

        db.commit()
        print(f"  Created {risk_count} risk records")

        # ── Notifications ─────────────────────────────────────────────────────
        print("\n[+] Creating notifications...")
        notif_count = 0
        for participant in random.sample(all_participants, 20):
            notif = Notification(
                user_id=participant.id,
                type="announcement",
                title="새로운 공지사항이 있습니다",
                message="확인해 주세요.",
                is_read=random.choice([True, False]),
                related_resource_type="announcement",
                related_resource_id=random.choice(announcements).id if announcements else None
            )
            db.add(notif)
            notif_count += 1

        db.commit()
        print(f"  Created {notif_count} notifications")

        # ── Summary ──────────────────────────────────────────────────────────
        print("\n" + "=" * 60)
        print("Seed Data Summary")
        print("=" * 60)
        print(f"  Users:          1 admin + {len(MANAGERS)} managers + {len(all_participants)} participants")
        print(f"  Announcements:  {len(announcements)}")
        print(f"  Health Checks:  {hc_count}")
        print(f"  Assignments:    {len(assignments)}")
        print(f"  Attendance:     {att_count}")
        print(f"  Daily Reports:  {dr_count}")
        print(f"  Risks:          {risk_count}")
        print(f"  Notifications:  {notif_count}")
        print("\nLogin Credentials:")
        print("  Admin:    admin / admin123")
        print("  Manager:  manager_us / manager123  (미국뉴욕)")
        print("  Manager:  manager_au / manager123  (호주)")
        print("  Manager:  manager_cn / manager123  (중국)")
        print("  Sample participant: participant_미국_01 / part123")
        print("=" * 60)
        print("\nDone! Database seeded successfully.")

    except Exception as e:
        print(f"\nError during seeding: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
