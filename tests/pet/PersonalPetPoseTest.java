package ru.eva.envtest;

public final class PersonalPetPoseTest {
    private static void check(boolean ok){if(!ok)throw new AssertionError();}
    public static void main(String[] args){
        check(PersonalPetPose.WIDTH*PersonalPetPose.COLUMNS==1152&&PersonalPetPose.HEIGHT*PersonalPetPose.ROWS==768);
        check(PersonalPetPose.row(PetMotion.LOOK_AROUND,PetMotion.CURIOUS,false,false,1)==PersonalPetPose.IDLE);
        check(PersonalPetPose.row(PetMotion.CROSS,PetMotion.WALK,false,false,1)==PersonalPetPose.WALK);
        check(PersonalPetPose.row(PetMotion.SEATED_PEEK,PetMotion.SIT,false,false,1)==PersonalPetPose.SIT);
        check(PersonalPetPose.row(PetMotion.SEATED_PEEK,PetMotion.SIT,false,true,.3f)==PersonalPetPose.IDLE);
        check(PersonalPetPose.row(PetMotion.SEATED_PEEK,PetMotion.SIT,true,true,.8f)==PersonalPetPose.ACTION);
        for(int row=0;row<PersonalPetPose.ROWS;row++){
            int interval=PersonalPetPose.interval(row);
            for(int i=0;i<16;i++)check(PersonalPetPose.column(row,interval*i,true)==i%8);
            check(PersonalPetPose.column(row,interval*6,false)==0);
        }
        System.out.println("All 32 personal pet cells use registered poses and motion preferences.");
    }
}
