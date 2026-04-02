export interface StudentRecord {
  sequence: string;
  studentId: string;
  title: string;
  firstName: string;
  lastName: string;
  nickname: string;
  searchableName: string;
  hometown: string;
  birthDate: string;
  age: string;
  phoneNumber: string;
  previousSchool: string;
  bloodType: string;
  religion: string;
  physicalTestScore: string;
  ptPullUp: string;
  ptPushUp: string;
  ptSitUp: string;
  ptRun2Miles: string;
  ptSwim100m: string;
  pt2PullUp: string;
  pt2PushUp: string;
  pt2SitUp: string;
  pt2Run2Miles: string;
  pt2Swim100m: string;
  raw: Record<string, string>;
}
