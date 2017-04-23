class Song < ApplicationRecord
  belongs_to :user, inverse_of: :songs
  has_many :comments, inverse_of: :song

  after_create :generate_permalink

  private

  def generate_permalink
    self.update_params(:permalink, (0...7).map { ('a'..'z').to_a[rand(26)] }.join)
  end
end
